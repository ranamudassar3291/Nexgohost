import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Server, ExternalLink, HardDrive, Activity, Shield, ShieldCheck, ShieldX,
  Calendar, ArrowUpCircle, ArrowDownCircle, XCircle, Globe, Loader2, AlertTriangle, X,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface HostingService {
  id: string; planName: string; domain: string | null; username: string | null;
  serverIp: string | null; status: string; billingCycle: string | null;
  nextDueDate: string | null; sslStatus: string; diskUsed: string | null;
  bandwidthUsed: string | null; cpanelUrl: string | null; webmailUrl: string | null;
  cancelRequested: boolean; cancelReason: string | null;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  suspended: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  terminated: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

function parseUsagePercent(used: string | null, limit: string | null): number {
  if (!used || !limit) return 0;
  const usedNum = parseFloat(used);
  const limitNum = parseFloat(limit);
  if (!limitNum || limitNum === 0) return 0;
  return Math.min(Math.round((usedNum / limitNum) * 100), 100);
}

export default function ClientHosting() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancelModal, setCancelModal] = useState<{ id: string; domain: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reinstallingSSL, setReinstallingSSL] = useState<string | null>(null);
  const [ssoLoading, setSsoLoading] = useState<Record<string, "cpanel" | "webmail" | null>>({});

  const handleReinstallSSL = async (serviceId: string, domain: string) => {
    setReinstallingSSL(serviceId);
    try {
      await apiFetch(`/api/client/hosting/${serviceId}/reinstall-ssl`, { method: "POST" });
      toast({ title: "SSL Reinstall Initiated", description: `Reinstalling SSL for ${domain}. This may take a moment.` });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["client-hosting"] });
        setReinstallingSSL(null);
      }, 3000);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setReinstallingSSL(null);
    }
  };

  const { data: services = [], isLoading } = useQuery<HostingService[]>({
    queryKey: ["client-hosting"],
    queryFn: () => apiFetch("/api/client/hosting"),
  });

  const handleCpanelLogin = async (service: HostingService) => {
    setSsoLoading(prev => ({ ...prev, [service.id]: "cpanel" }));
    try {
      const result = await apiFetch(`/api/client/hosting/${service.id}/cpanel-login`, { method: "POST" });
      if (result.url) {
        window.open(result.url, "_blank");
      } else {
        throw new Error("No login URL returned");
      }
    } catch (err: any) {
      toast({ title: "cPanel Login Failed", description: err.message, variant: "destructive" });
    } finally {
      setSsoLoading(prev => ({ ...prev, [service.id]: null }));
    }
  };

  const handleWebmailLogin = async (service: HostingService) => {
    setSsoLoading(prev => ({ ...prev, [service.id]: "webmail" }));
    try {
      const result = await apiFetch(`/api/client/hosting/${service.id}/webmail-login`, { method: "POST" });
      if (result.url) {
        window.open(result.url, "_blank");
      } else {
        throw new Error("No login URL returned");
      }
    } catch (err: any) {
      toast({ title: "Webmail Login Failed", description: err.message, variant: "destructive" });
    } finally {
      setSsoLoading(prev => ({ ...prev, [service.id]: null }));
    }
  };

  const handleCancelRequest = async () => {
    if (!cancelModal) return;
    setCancelling(true);
    try {
      await apiFetch(`/api/client/hosting/${cancelModal.id}/cancel-request`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason || "Requested by client" }),
      });
      queryClient.invalidateQueries({ queryKey: ["client-hosting"] });
      toast({ title: "Cancellation requested", description: "Our team will process your request." });
      setCancelModal(null); setCancelReason("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setCancelling(false); }
  };

  if (isLoading) return (
    <div className="flex justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Cancel modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2 text-destructive">
                <AlertTriangle size={18} /> Request Cancellation
              </h2>
              <Button variant="ghost" size="icon" onClick={() => { setCancelModal(null); setCancelReason(""); }}>
                <X size={18} />
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                You are requesting cancellation for <strong className="text-foreground">{cancelModal.domain}</strong>.
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
                <Button variant="outline" onClick={() => { setCancelModal(null); setCancelReason(""); }}>Keep Service</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">My Hosting</h2>
        <p className="text-muted-foreground mt-1">Manage your active hosting services and control panels.</p>
      </div>

      {services.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-3xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
            <Server className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground">No Hosting Services</h3>
          <p className="text-muted-foreground mt-2 max-w-md">You don't have any hosting plans. Browse our plans to get started.</p>
          <Button className="mt-6 bg-primary" onClick={() => setLocation("/client/orders/new")}>Order Hosting</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {services.map(service => (
            <motion.div key={service.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-colors">
              
              {/* Header */}
              <div className="p-6 border-b border-border/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-[40px]" />
                <div className="relative flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-bold text-foreground">{service.planName}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${statusColors[service.status] || "bg-secondary border-border text-muted-foreground"}`}>
                        {service.status}
                      </span>
                      {service.cancelRequested && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          Cancellation Pending
                        </span>
                      )}
                    </div>
                    {service.domain && (
                      <div className="flex items-center gap-1.5 text-primary font-medium">
                        <Globe size={14} />
                        <span>{service.domain}</span>
                      </div>
                    )}
                  </div>

                  {/* SSL Status */}
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
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/50 border-b border-border/50">
                {[
                  { label: "Server", value: service.serverIp || "Pending setup", icon: Server },
                  { label: "Username", value: service.username || "—", icon: Shield },
                  { label: "Billing", value: service.billingCycle || "Monthly", icon: Calendar },
                  {
                    label: "Next Due Date",
                    value: service.nextDueDate ? format(new Date(service.nextDueDate), "MMM d, yyyy") : "—",
                    icon: Calendar,
                  },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="p-4 text-center">
                    <Icon size={14} className="text-muted-foreground mx-auto mb-1" />
                    <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                    <div className="text-sm font-medium text-foreground truncate">{value}</div>
                  </div>
                ))}
              </div>

              {/* Usage bars */}
              <div className="p-5 space-y-3 border-b border-border/50">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Disk Usage", used: service.diskUsed, limit: "10 GB", icon: HardDrive },
                    { label: "Bandwidth", used: service.bandwidthUsed, limit: "100 GB", icon: Activity },
                  ].map(({ label, used, limit, icon: Icon }) => {
                    const pct = parseUsagePercent(used, limit);
                    return (
                      <div key={label}>
                        <div className="flex justify-between items-center mb-1.5">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Icon size={12} /> {label}
                          </div>
                          <span className="text-xs font-medium text-foreground">{used || "0 MB"}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct > 80 ? "bg-red-400" : pct > 60 ? "bg-yellow-400" : "bg-primary"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-5 flex flex-wrap gap-2.5">
                <Button
                  onClick={() => handleCpanelLogin(service)}
                  className="gap-2 bg-primary hover:bg-primary/90"
                  disabled={service.status !== "active" || !!ssoLoading[service.id]}
                >
                  {ssoLoading[service.id] === "cpanel"
                    ? <Loader2 size={15} className="animate-spin" />
                    : <ExternalLink size={15} />}
                  {ssoLoading[service.id] === "cpanel" ? "Logging in..." : "Login to cPanel"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleWebmailLogin(service)}
                  className="gap-2"
                  disabled={service.status !== "active" || !!ssoLoading[service.id]}
                >
                  {ssoLoading[service.id] === "webmail"
                    ? <Loader2 size={15} className="animate-spin" />
                    : <ExternalLink size={15} />}
                  {ssoLoading[service.id] === "webmail" ? "Logging in..." : "Login to Webmail"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleReinstallSSL(service.id, service.domain || service.planName)}
                  className="gap-2"
                  disabled={service.status !== "active" || reinstallingSSL === service.id}
                >
                  {reinstallingSSL === service.id ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
                  {reinstallingSSL === service.id ? "Reinstalling..." : "Reinstall SSL"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/client/orders/new")}
                  className="gap-2"
                >
                  <ArrowUpCircle size={15} /> Upgrade Plan
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/client/orders/new")}
                  className="gap-2"
                >
                  <ArrowDownCircle size={15} /> Downgrade Plan
                </Button>
                {!service.cancelRequested && service.status !== "terminated" && (
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
                    onClick={() => { setCancelModal({ id: service.id, domain: service.domain || service.planName }); }}
                  >
                    <XCircle size={15} /> Cancel Service
                  </Button>
                )}
                {service.cancelRequested && (
                  <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle size={14} className="text-orange-400" />
                    Cancellation requested
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
