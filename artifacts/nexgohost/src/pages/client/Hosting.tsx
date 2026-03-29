import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Server, Globe, Calendar, Settings, Cpu, Zap, ExternalLink, Loader2, Mail,
  ChevronRight, Wifi, HardDrive, ShieldCheck, Sparkles, RefreshCw, Clock, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";
import { format } from "date-fns";
import { useState } from "react";

interface HostingService {
  id: string;
  planName: string;
  domain: string | null;
  status: string;
  nextDueDate: string | null;
  cancelRequested: boolean;
  diskSpace?: string;
  bandwidth?: string;
  canManage: boolean;
  manageLockReason: string | null;
}

interface HostingPlan {
  id: string;
  name: string;
  price: number;
  yearlyPrice?: number | null;
  diskSpace: string;
  bandwidth: string;
  emailAccounts?: string;
  features?: string[];
}

async function apiFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const BRAND_GRADIENT = "linear-gradient(135deg, #701AFE 0%, #9B51E0 60%, #C084FC 100%)";

const statusConfig: Record<string, { dot: string; badge: string; label: string; pulse: boolean }> = {
  active:    { dot: "bg-green-400",  badge: "bg-green-500/15 text-green-400 border-green-500/25",  label: "Active",    pulse: true  },
  suspended: { dot: "bg-orange-400", badge: "bg-orange-500/15 text-orange-400 border-orange-500/25", label: "Suspended", pulse: false },
  terminated:{ dot: "bg-red-400",   badge: "bg-red-500/15 text-red-400 border-red-500/25",   label: "Terminated",pulse: false },
  pending:   { dot: "bg-yellow-400", badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25", label: "Pending",   pulse: true  },
};

function isVpsService(planName: string) {
  return /^vps/i.test(planName) || /virtual\s*private/i.test(planName);
}

function getDaysUntilRenewal(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function ClientHosting() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const [ssoLoading, setSsoLoading] = useState<Record<string, "cpanel" | "webmail" | null>>({});

  const { data: services = [], isLoading } = useQuery<HostingService[]>({
    queryKey: ["client-hosting"],
    queryFn: () => apiFetch("/api/client/hosting"),
  });

  const { data: allPlans = [] } = useQuery<HostingPlan[]>({
    queryKey: ["hosting-plans-public"],
    queryFn: () => fetch("/api/hosting/plans").then(r => r.json()),
    enabled: services.length === 0,
  });

  const topPlans = allPlans.filter(p => !isVpsService(p.name)).slice(0, 3);

  async function handleQuickLogin(serviceId: string, type: "cpanel" | "webmail") {
    setSsoLoading(p => ({ ...p, [serviceId]: type }));
    try {
      const endpoint = type === "cpanel" ? "cpanel-login" : "webmail-login";
      const data = await apiFetch(`/api/client/hosting/${serviceId}/${endpoint}`, { method: "POST" });
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        toast({ title: "Login failed", description: data.error || "Could not open control panel.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Login failed", description: e.message || "Could not connect.", variant: "destructive" });
    } finally {
      setSsoLoading(p => ({ ...p, [serviceId]: null }));
    }
  }

  const vpsServices     = services.filter(s => isVpsService(s.planName));
  const hostingServices = services.filter(s => !isVpsService(s.planName));

  function ServiceCard({ service }: { service: HostingService }) {
    const isVps = isVpsService(service.planName);
    const isActive = service.status === "active";
    const loading = ssoLoading[service.id];
    const cfg = statusConfig[service.status] ?? { dot: "bg-muted-foreground", badge: "bg-secondary border-border text-muted-foreground", label: service.status, pulse: false };
    const daysLeft = getDaysUntilRenewal(service.nextDueDate);
    const renewingSoon = daysLeft !== null && daysLeft <= 14 && daysLeft >= 0;
    const isExpired = daysLeft !== null && daysLeft < 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl border overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/5"
        style={{
          background: "linear-gradient(135deg, rgba(112,26,254,0.04) 0%, rgba(155,81,224,0.02) 50%, rgba(var(--card)) 100%)",
          borderColor: isActive ? "rgba(112,26,254,0.18)" : "rgba(var(--border))",
        }}
      >
        {/* Top accent line for active services */}
        {isActive && (
          <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: BRAND_GRADIENT }} />
        )}

        <div className="p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              {/* Plan icon */}
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                style={{ background: isVps ? "linear-gradient(135deg, #701AFE25 0%, #9B59FE20 100%)" : "rgba(112,26,254,0.1)" }}>
                {isVps ? <Cpu size={20} className="text-primary" /> : <Server size={20} className="text-primary" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground">{service.planName}</span>
                  {isVps && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-0.5">
                      <Zap size={8} /> VPS
                    </span>
                  )}
                  {service.cancelRequested && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                      Cancel Pending
                    </span>
                  )}
                </div>
                {service.domain && (
                  <div className="flex items-center gap-1 text-sm text-primary/80 mt-0.5">
                    <Globe size={11} /> <span className="font-mono truncate">{service.domain}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status badge with pulsing dot */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${cfg.badge}`}>
              <span className="relative flex h-1.5 w-1.5">
                {cfg.pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.dot}`} />}
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${cfg.dot}`} />
              </span>
              {cfg.label}
            </div>
          </div>

          {/* Resource specs */}
          {(service.diskSpace || service.bandwidth) && (
            <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
              {service.diskSpace && <span className="flex items-center gap-1"><HardDrive size={11} /> {service.diskSpace}</span>}
              {service.bandwidth && <span className="flex items-center gap-1"><Wifi size={11} /> {service.bandwidth}</span>}
            </div>
          )}

          {/* Renewal info */}
          {service.nextDueDate && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-xs ${
              isExpired
                ? "bg-red-500/10 border border-red-500/20 text-red-400"
                : renewingSoon
                ? "bg-orange-500/10 border border-orange-500/20 text-orange-400"
                : "bg-secondary/60 border border-border/50 text-muted-foreground"
            }`}>
              <Clock size={11} className="shrink-0" />
              <span>
                {isExpired
                  ? `Expired ${Math.abs(daysLeft!)} day${Math.abs(daysLeft!) !== 1 ? "s" : ""} ago`
                  : `Renews ${format(new Date(service.nextDueDate), "MMM d, yyyy")}${daysLeft !== null ? ` · ${daysLeft}d` : ""}`}
              </span>
              {(renewingSoon || isExpired) && (
                <button
                  onClick={() => setLocation(isVps ? `/client/vps/${service.id}` : `/client/hosting/${service.id}`)}
                  className="ml-auto font-bold underline underline-offset-2 shrink-0 hover:no-underline"
                >
                  Renew →
                </button>
              )}
            </div>
          )}

          {/* Management lock banner */}
          {!service.canManage && service.manageLockReason && (
            <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-xl bg-red-500/8 border border-red-500/20 text-xs text-red-400">
              <Lock size={11} className="shrink-0 mt-0.5" />
              <span>{service.manageLockReason}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {service.canManage ? (
              <button
                onClick={() => setLocation(isVps ? `/client/vps/${service.id}` : `/client/hosting/${service.id}`)}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90"
                style={{ background: BRAND_GRADIENT }}
              >
                {isVps ? <Cpu size={14} /> : <Settings size={14} />}
                {isVps ? "Manage VPS" : "Manage Service"}
                <ChevronRight size={13} />
              </button>
            ) : (
              <span
                title={service.manageLockReason || "Management disabled"}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-muted-foreground shadow-sm cursor-not-allowed select-none bg-secondary/60 border border-border"
              >
                <Lock size={13} />
                {isVps ? "Manage VPS" : "Manage Service"}
                <ChevronRight size={13} />
              </span>
            )}

            {!isVps && isActive && (
              <>
                <button
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium border border-border bg-card hover:bg-secondary/60 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!!loading || !service.canManage}
                  title={!service.canManage ? (service.manageLockReason || "Management disabled") : undefined}
                  onClick={() => service.canManage && handleQuickLogin(service.id, "cpanel")}
                >
                  {loading === "cpanel" ? <Loader2 size={13} className="animate-spin" /> : !service.canManage ? <Lock size={13} /> : <ExternalLink size={13} />}
                  {loading === "cpanel" ? "Opening…" : "cPanel"}
                </button>
                <button
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium border border-border bg-card hover:bg-secondary/60 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!!loading || !service.canManage}
                  title={!service.canManage ? (service.manageLockReason || "Management disabled") : undefined}
                  onClick={() => service.canManage && handleQuickLogin(service.id, "webmail")}
                >
                  {loading === "webmail" ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                  {loading === "webmail" ? "Opening…" : "Webmail"}
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  if (isLoading) return (
    <div className="flex justify-center p-16">
      <div className="animate-spin rounded-full h-9 w-9 border-2 border-primary border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">My Services</h2>
          <p className="text-muted-foreground mt-1">Manage your active hosting services and VPS servers.</p>
        </div>
        {services.length > 0 && (
          <button
            onClick={() => setLocation("/client/orders/new")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white shadow-md hover:opacity-90 transition-opacity shrink-0"
            style={{ background: BRAND_GRADIENT }}
          >
            <Sparkles size={14} /> Add Service
          </button>
        )}
      </div>

      {services.length === 0 ? (
        /* ── Empty state: Start Your Journey ────────────────────────────────── */
        <div className="space-y-6">
          <div className="rounded-3xl border border-dashed border-primary/25 p-10 text-center flex flex-col items-center"
            style={{ background: "linear-gradient(135deg, rgba(112,26,254,0.04) 0%, rgba(155,81,224,0.02) 100%)" }}>
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
              style={{ background: BRAND_GRADIENT }}>
              <Server className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-foreground">Start Your Hosting Journey</h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              You don't have any active services yet. Choose a plan below to get started — your site can be live in minutes.
            </p>
            <button
              onClick={() => setLocation("/client/orders/new")}
              className="mt-6 flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-bold text-white shadow-lg hover:opacity-90 transition-opacity"
              style={{ background: BRAND_GRADIENT }}
            >
              <Sparkles size={15} /> Browse All Plans
            </button>
          </div>

          {/* Top plans comparison */}
          {topPlans.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Popular Plans</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topPlans.map((plan, i) => (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className={`relative rounded-2xl border p-5 flex flex-col gap-3 ${i === 1 ? "border-primary/40 shadow-lg shadow-primary/10" : "border-border"}`}
                    style={i === 1 ? { background: "linear-gradient(135deg, rgba(112,26,254,0.05) 0%, rgba(155,81,224,0.03) 100%)" } : {}}
                  >
                    {i === 1 && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold text-white shadow"
                        style={{ background: BRAND_GRADIENT }}>
                        MOST POPULAR
                      </div>
                    )}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-foreground">{plan.name}</p>
                        <p className="text-2xl font-bold text-primary mt-0.5">
                          {formatPrice(plan.price)}
                          <span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </p>
                      </div>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: "rgba(112,26,254,0.1)" }}>
                        <Server size={16} className="text-primary" />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5"><HardDrive size={11} /> {plan.diskSpace} Disk Storage</div>
                      <div className="flex items-center gap-1.5"><Wifi size={11} /> {plan.bandwidth} Bandwidth</div>
                      {plan.emailAccounts && <div className="flex items-center gap-1.5"><Mail size={11} /> {plan.emailAccounts} Email Accounts</div>}
                      {plan.features?.slice(0, 2).map(f => (
                        <div key={f} className="flex items-center gap-1.5">
                          <ShieldCheck size={11} className="text-green-400 shrink-0" /> {f}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setLocation(`/client/orders/new?plan=${plan.id}`)}
                      className="mt-auto w-full h-9 rounded-xl text-sm font-semibold transition-all"
                      style={i === 1
                        ? { background: BRAND_GRADIENT, color: "white" }
                        : { border: "1px solid rgba(var(--border))", color: "var(--foreground)", background: "transparent" }}
                    >
                      Get Started →
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Service Cards ─────────────────────────────────────────────── */
        <div className="space-y-8">
          {vpsServices.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Cpu size={15} className="text-primary" />
                <h3 className="text-[14px] font-bold text-foreground">VPS Servers</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">{vpsServices.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {vpsServices.map(s => <ServiceCard key={s.id} service={s} />)}
              </div>
            </section>
          )}

          {hostingServices.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Server size={15} className="text-primary" />
                <h3 className="text-[14px] font-bold text-foreground">Web Hosting</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">{hostingServices.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {hostingServices.map(s => <ServiceCard key={s.id} service={s} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
