import { useState, useEffect, useRef } from "react";
import { useGetClientDashboard, useGetMe } from "@workspace/api-client-react";
import { Server, Globe, FileText, Ticket, ShoppingCart, Clock, DollarSign, Terminal, Mail, ExternalLink, Loader2, Wallet, Gift, AlertTriangle, Sparkles, Award, BookOpen, Megaphone, HardDrive, Wifi, CheckCircle2, Rocket, Lock, BadgeCheck, ShieldCheck, Zap, Star, RefreshCw, Globe2, PartyPopper } from "lucide-react";
import { WelcomeTour, useWelcomeTour } from "@/components/WelcomeTour";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useCurrency } from "@/context/CurrencyProvider";

interface Order {
  id: string; itemName: string; amount: number; billingCycle: string;
  status: string; paymentStatus: string; createdAt: string; type: string; domain: string | null;
}

interface HostingService {
  id: string; planName: string; domain: string | null; status: string;
  cpanelUrl: string | null; webmailUrl: string | null; username: string | null;
  nextDueDate: string | null; billingCycle: string; freeDomainAvailable: boolean;
  diskUsed?: string | null; bandwidthUsed?: string | null;
}

interface UsageData {
  disk: { usedFmt: string; limitFmt: string; pct: number };
  bandwidth: { usedFmt: string; limitFmt: string; pct: number };
}

interface DomainItem {
  id: string; name: string; tld: string; status: string; expiryDate: string | null;
}
interface Announcement {
  id: string; title: string; message: string; type: string; isActive: boolean;
}

function UsageBar({ label, pct, used, limit, icon: Icon, color }: { label: string; pct: number; used: string; limit: string; icon: any; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className={`flex items-center gap-1 ${color}`}><Icon size={9} />{label}</span>
        <span>{used} / {limit}</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500"}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function ServiceUsageWidget({ serviceId }: { serviceId: string }) {
  const token = localStorage.getItem("token");
  const { data: usage } = useQuery<UsageData>({
    queryKey: ["hosting-usage", serviceId],
    queryFn: () => fetch(`/api/client/hosting/${serviceId}/usage`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.ok ? r.json() : null).catch(() => null),
    staleTime: 60_000,
    retry: false,
  });

  if (!usage || !usage.disk || !usage.bandwidth) return null;
  return (
    <div className="space-y-2 pt-1 border-t border-border/40 mt-1">
      <UsageBar label="Disk" pct={usage.disk.pct ?? 0} used={usage.disk.usedFmt ?? "0 MB"} limit={usage.disk.limitFmt ?? "∞"} icon={HardDrive} color="text-blue-400" />
      <UsageBar label="Bandwidth" pct={usage.bandwidth.pct ?? 0} used={usage.bandwidth.usedFmt ?? "0 MB"} limit={usage.bandwidth.limitFmt ?? "∞"} icon={Wifi} color="text-violet-400" />
    </div>
  );
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Request failed"); }
  return res.json();
}

interface SetupProgress {
  step1: boolean; step2: boolean; step3: boolean;
  allComplete: boolean; primaryDomain: string | null;
  siteUrl: string | null; pct: number;
}

const CONFETTI_COLORS = ["#4F46E5", "#6366F1", "#818CF8", "#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#F97316"];

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 32 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${3 + (i * 3.1) % 94}%`,
    delay: `${(i * 0.08) % 1.8}s`,
    duration: `${1.8 + (i * 0.11) % 1.2}s`,
    size: i % 3 === 0 ? 10 : i % 3 === 1 ? 7 : 5,
    rotation: i % 2 === 0 ? "360deg" : "-360deg",
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10" aria-hidden="true">
      {pieces.map(p => (
        <div key={p.id} style={{
          position: "absolute", top: "-12px", left: p.left,
          width: p.size, height: p.size,
          backgroundColor: p.color,
          borderRadius: p.id % 4 === 0 ? "50%" : "2px",
          animationName: "confettiFall",
          animationDuration: p.duration,
          animationDelay: p.delay,
          animationTimingFunction: "ease-in",
          animationIterationCount: "1",
          animationFillMode: "forwards",
        }} />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0)    rotate(0deg) scale(1);   opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(340px) rotate(720deg) scale(0.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

const orderStatusColors: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  approved:  "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  suspended: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function ClientDashboard() {
  const { show: showTour, dismiss: dismissTour } = useWelcomeTour();
  const { data: stats, isLoading } = useGetClientDashboard();
  const { data: user } = useGetMe();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const [ssoLoading, setSsoLoading] = useState<Record<string, "cpanel" | "webmail" | null>>({});

  const handleSsoLogin = async (serviceId: string, type: "cpanel" | "webmail") => {
    setSsoLoading(prev => ({ ...prev, [serviceId]: type }));
    try {
      const endpoint = type === "cpanel"
        ? `/api/client/hosting/${serviceId}/cpanel-login`
        : `/api/client/hosting/${serviceId}/webmail-login`;
      const result = await apiFetch(endpoint, { method: "POST" });
      if (result.url) {
        window.open(result.url, "_blank");
      } else {
        throw new Error("No login URL returned");
      }
    } catch (err: any) {
      toast({ title: `${type === "cpanel" ? "cPanel" : "Webmail"} Login Failed`, description: err.message, variant: "destructive" });
    } finally {
      setSsoLoading(prev => ({ ...prev, [serviceId]: null }));
    }
  };

  const { data: recentOrders = [] } = useQuery<Order[]>({
    queryKey: ["my-orders-dashboard"],
    queryFn: () => apiFetch("/api/orders").then(d => (d || []).slice(0, 5)),
  });

  const { data: creditsData } = useQuery<{ creditBalance: string }>({
    queryKey: ["my-credits"],
    queryFn: () => apiFetch("/api/my/credits"),
  });
  const creditBalance = parseFloat(creditsData?.creditBalance ?? "0");

  const queryClient = useQueryClient();
  const { data: allServices = [] } = useQuery<HostingService[]>({
    queryKey: ["client-services-dashboard"],
    queryFn: () => apiFetch("/api/client/hosting").then(d => d || []),
  });
  const { data: allDomains = [] } = useQuery<DomainItem[]>({
    queryKey: ["client-domains-dashboard"],
    queryFn: () => apiFetch("/api/domains").then(d => d || []),
  });
  const { data: setupProgress, refetch: refetchProgress } = useQuery<SetupProgress>({
    queryKey: ["client-setup-progress"],
    queryFn: () => apiFetch("/api/client/setup-progress"),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
  const [confettiActive, setConfettiActive] = useState(false);
  useEffect(() => {
    if (setupProgress?.allComplete) {
      setConfettiActive(true);
      const t = setTimeout(() => setConfettiActive(false), 3000);
      return () => clearTimeout(t);
    }
  }, [setupProgress?.allComplete]);
  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["public-announcements"],
    queryFn: () => fetch("/api/announcements").then(r => r.json()).then(d => (d.announcements || []).filter((a: Announcement) => a.isActive)),
    staleTime: 60_000,
  });
  const activeServices = allServices.filter(s => s.status === "active");

  // Expiry alerts: services/domains expiring within 15 days
  const now = Date.now();
  const ALERT_DAYS = 15;
  const expiringServices = allServices
    .filter(s => s.status === "active" && s.nextDueDate)
    .map(s => {
      const due = new Date(s.nextDueDate!).getTime();
      const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
      return { name: s.domain || s.planName, type: "Hosting", daysLeft };
    })
    .filter(s => s.daysLeft >= 0 && s.daysLeft <= ALERT_DAYS);
  const expiringDomains = allDomains
    .filter(d => d.status === "active" && d.expiryDate)
    .map(d => {
      const exp = new Date(d.expiryDate!).getTime();
      const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      return { name: `${d.name}${d.tld}`, type: "Domain", daysLeft };
    })
    .filter(d => d.daysLeft >= 0 && d.daysLeft <= ALERT_DAYS);
  const expiryAlerts = [...expiringServices, ...expiringDomains].sort((a, b) => a.daysLeft - b.daysLeft);
  const freeDomainService = allServices.find(s => s.freeDomainAvailable);

  async function handleClaimFreeDomain() {
    if (!freeDomainService) return;
    try {
      await apiFetch(`/api/client/hosting/${freeDomainService.id}/claim-free-domain`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["client-services-dashboard"] });
      navigate("/client/orders/new?freeDomain=1");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!stats) return null;

  const cards = [
    { title: "Active Services", value: stats.activeServices, icon: Server, link: "/client/hosting", color: "text-blue-400" },
    { title: "Domains", value: stats.activeDomains, icon: Globe, link: "/client/domains", color: "text-purple-400" },
    { title: "Unpaid Invoices", value: stats.unpaidInvoices, icon: FileText, link: "/client/invoices", color: "text-red-400", highlight: stats.unpaidInvoices > 0 },
    { title: "Open Tickets", value: stats.openTickets, icon: Ticket, link: "/client/tickets", color: "text-orange-400" },
  ];

  const pendingOrders = recentOrders.filter(o => o.status === "pending").length;

  // Client lifecycle
  const clientSince = user?.createdAt ? new Date(user.createdAt) : null;
  const daysSinceJoining = clientSince
    ? Math.floor((Date.now() - clientSince.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isNewClient = daysSinceJoining <= 30;
  const isReturningClient = daysSinceJoining > 30;
  const loyaltyLabel = daysSinceJoining >= 365
    ? "⭐ Premium Member"
    : daysSinceJoining >= 180
      ? "🥈 Silver Member"
      : "🥉 Bronze Member";
  const tenureLabel = daysSinceJoining >= 365
    ? `${Math.floor(daysSinceJoining / 365)} Year${Math.floor(daysSinceJoining / 365) === 1 ? "" : "s"}`
    : `${Math.max(1, Math.floor(daysSinceJoining / 30))} Month${Math.max(1, Math.floor(daysSinceJoining / 30)) === 1 ? "" : "s"}`;

  return (
    <>
    <div className="space-y-8">
      {/* Announcements Marquee — Hostinger-style slim bar at the very top */}
      {announcements.length > 0 && (
        <div className="flex items-center rounded-xl overflow-hidden shadow-md"
          style={{ background: "linear-gradient(90deg, #1d4ed8 0%, #2563eb 60%, #1e40af 100%)" }}>
          {/* Label badge */}
          <div className="flex items-center gap-1.5 shrink-0 px-4 py-2.5 font-bold text-xs uppercase tracking-widest text-white whitespace-nowrap border-r border-white/20"
            style={{ background: "rgba(0,0,0,0.18)" }}>
            <Megaphone className="h-3.5 w-3.5" />
            <span>News</span>
          </div>
          {/* Scrolling text */}
          <div className="overflow-hidden flex-1 relative py-2.5 px-4">
            <div
              className="flex gap-14 whitespace-nowrap"
              style={{ animation: `nexgo-marquee ${Math.max(18, announcements.length * 10)}s linear infinite` }}
            >
              {[...announcements, ...announcements].map((a, i) => (
                <span key={i} className="text-sm inline-flex items-center gap-2 text-white">
                  <span className="font-bold">{a.title}</span>
                  <span className="opacity-90">{a.message}</span>
                  <span className="opacity-40 mx-2">•</span>
                </span>
              ))}
            </div>
          </div>
          <style>{`@keyframes nexgo-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
        </div>
      )}

      {/* Hero banner */}
      <div className="bg-gradient-to-r from-primary/20 via-purple-600/10 to-transparent border border-primary/10 rounded-3xl p-5 sm:p-8 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px]" />
        <div className="relative z-10">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Welcome back, {user?.firstName}!</h2>
          <p className="text-muted-foreground mt-2 sm:text-lg">Manage your digital infrastructure securely.</p>
          {pendingOrders > 0 && (
            <div className="mt-3 flex items-center gap-2 text-yellow-400 text-sm">
              <Clock size={15} />
              <span>You have {pendingOrders} pending order{pendingOrders > 1 ? "s" : ""} awaiting approval</span>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-primary hover:bg-primary/90 text-white shadow-sm">
              <Link href="/client/hosting">View Services</Link>
            </Button>
            <Button asChild variant="outline" className="bg-card/50 backdrop-blur border-border/50">
              <Link href="/client/tickets">Open Ticket</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <Link key={i} href={card.link}>
            <div className={`bg-card border ${card.highlight ? "border-red-500/30 shadow-red-500/10" : "border-border"} rounded-2xl p-6 shadow-lg shadow-black/5 hover:-translate-y-1 transition-all duration-300 group cursor-pointer`}>
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-secondary/50 border border-border group-hover:bg-secondary transition-colors ${card.color}`}>
                  <card.icon size={24} />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-foreground">{card.value}</h3>
              <p className="text-sm font-medium text-muted-foreground mt-1">{card.title}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Launch Progress Wizard ── */}
      {setupProgress && !setupProgress.allComplete && allDomains.length > 0 && (() => {
        const pct = setupProgress.pct;
        const s1 = setupProgress.step1;
        const s2 = setupProgress.step2;
        const steps = [
          {
            label: "Register Domain", icon: Globe, done: s1,
            desc: s1 ? (setupProgress.primaryDomain ?? "Your domain is ready") : "Order a domain to get started.",
            cta: !s1 ? { label: "Get Domain →", href: "/client/domains" } : null,
            color: "emerald",
          },
          {
            label: "Setup Hosting", icon: Server, done: s2,
            desc: s2 ? "Hosting is active and running." : "Your domain needs a server to go live.",
            cta: !s2 ? { label: "Get Hosting →", href: "/client/orders/new" } : null,
            color: "primary",
          },
          {
            label: "Website Live", icon: Rocket, done: false,
            desc: "Complete the steps above to go live.",
            cta: null,
            color: "violet",
            locked: !s1 || !s2,
          },
        ];
        return (
          <div className="rounded-2xl border border-violet-500/25 overflow-hidden shadow-lg"
            style={{ background: "linear-gradient(135deg, rgba(112,26,254,0.06) 0%, rgba(155,81,224,0.04) 100%)" }}>
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-violet-500/15"
              style={{ background: "rgba(112,26,254,0.09)" }}>
              <Rocket size={16} className="text-primary shrink-0" />
              <p className="text-sm font-bold text-primary">Launch your website — 3 steps to go live</p>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {pct}% Complete
              </span>
            </div>
            <div className="h-1.5 w-full bg-primary/10">
              <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#4F46E5,#6366F1)" }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-violet-500/10">
              {steps.map((step, i) => (
                <div key={i} className={`px-5 py-4 flex items-start gap-3 ${step.locked ? "opacity-45" : ""}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${
                    step.done
                      ? "bg-emerald-500/15 border-emerald-500/50"
                      : step.locked
                        ? "bg-secondary border-border"
                        : "bg-primary/10 border-primary animate-pulse"
                  }`}>
                    {step.done
                      ? <CheckCircle2 size={18} className="text-emerald-500" />
                      : step.locked
                        ? <Lock size={16} className="text-muted-foreground" />
                        : <step.icon size={16} className="text-primary" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-sm">{step.label}</p>
                    <p className={`text-xs font-medium mt-0.5 ${step.done ? "text-emerald-500" : step.locked ? "text-muted-foreground" : "text-orange-400"}`}>
                      {step.done ? "Completed ✓" : step.locked ? "Locked 🔒" : "Pending ⏳"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">{step.desc}</p>
                    {step.cta && (
                      <Link href={step.cta.href}>
                        <button className="h-8 px-3 rounded-lg text-xs font-bold text-white shadow-md"
                          style={{ background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)" }}>
                          {step.cta.label}
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Celebration Card — Website is LIVE ── */}
      {setupProgress?.allComplete && (
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-violet-500/40"
          style={{ background: "linear-gradient(135deg, #0f0523 0%, #1a0540 40%, #2d0a6b 100%)" }}>
          <Confetti active={confettiActive} />
          {/* Glow ring */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(112,26,254,0.45) 0%, transparent 70%)",
          }} />
          <div className="relative z-[1] p-8 text-center flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"
              style={{ background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 60%, #818CF8 100%)", boxShadow: "0 0 60px rgba(112,26,254,0.7)" }}>
              <PartyPopper size={36} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Congratulations! 🎉
              </h2>
              <p className="text-base font-semibold text-violet-200 mt-1">Your brand is now global.</p>
              <p className="text-sm text-violet-300/80 mt-2 max-w-md mx-auto">
                Your website is officially <span className="text-white font-bold">LIVE</span>
                {setupProgress.primaryDomain ? ` at ` : ""}
                {setupProgress.primaryDomain && (
                  <a href={setupProgress.siteUrl ?? "#"} target="_blank" rel="noopener noreferrer"
                    className="font-bold text-violet-200 underline underline-offset-2 hover:text-white transition-colors">
                    {setupProgress.primaryDomain}
                  </a>
                )}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/client/hosting">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg border border-white/20 hover:border-white/40 transition-all"
                  style={{ background: "linear-gradient(135deg, #4F46E5, #6366F1)" }}>
                  <Server size={14} /> Manage Website
                </button>
              </Link>
              {setupProgress.siteUrl && (
                <a href={setupProgress.siteUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg border border-white/20 hover:bg-white/10 transition-all">
                  <ExternalLink size={14} /> Open Site
                </a>
              )}
              <Link href="/client/tickets">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-violet-200 border border-violet-500/40 hover:bg-violet-500/10 transition-all">
                  <Mail size={14} /> Create Email
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Next Best Action (shown when site is live) ── */}
      {setupProgress?.allComplete && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2"
            style={{ background: "linear-gradient(90deg, rgba(112,26,254,0.05) 0%, transparent 100%)" }}>
            <Zap size={15} className="text-primary" />
            <p className="text-sm font-bold text-foreground">Growth Opportunities for Your Brand</p>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Site Live ✓</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {/* .net / .org brand protection */}
            {[".net", ".org"].map(ext => (
              <div key={ext} className="px-5 py-4 flex gap-3 hover:bg-secondary/20 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                  <ShieldCheck size={17} className="text-orange-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">Secure your brand with {ext}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    Register <span className="font-mono text-foreground">{setupProgress.primaryDomain?.replace(/\.[^.]+$/, "") ?? "yourdomain"}{ext}</span> before someone else does.
                  </p>
                  <Link href="/client/domains">
                    <button className="h-7 px-3 rounded-lg text-[11px] font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #4F46E5, #6366F1)" }}>
                      Register {ext} →
                    </button>
                  </Link>
                </div>
              </div>
            ))}
            {/* Professional Email */}
            <div className="px-5 py-4 flex gap-3 hover:bg-secondary/20 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Mail size={17} className="text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">Boost Trust with Email</p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Get a professional address like <span className="font-mono text-foreground">info@{setupProgress.primaryDomain ?? "yourdomain.com"}</span>
                </p>
                <Link href="/client/orders/new">
                  <button className="h-7 px-3 rounded-lg text-[11px] font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #4F46E5, #6366F1)" }}>
                    Get Business Email →
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Client Lifecycle Widget ─────────────────────────────────────── */}

      {/* New Client (Month 1) — Getting Started Guide */}
      {isNewClient && (
        <div className="rounded-2xl border border-primary/20 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(112,26,254,0.06) 0%, rgba(112,26,254,0.02) 100%)" }}>
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-primary/15" style={{ background: "rgba(112,26,254,0.08)" }}>
            <Sparkles size={16} className="text-primary shrink-0" />
            <p className="text-sm font-bold text-primary">Welcome to Noehost! Your journey starts here.</p>
            {daysSinceJoining === 0 && <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Just joined!</span>}
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground mb-3">
              You joined <span className="font-semibold text-foreground">{daysSinceJoining === 0 ? "today" : `${daysSinceJoining} day${daysSinceJoining === 1 ? "" : "s"} ago`}</span>. Here are some guides to help you get started quickly:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { label: "How to access your cPanel", href: "/client/hosting" },
                { label: "How to add or transfer a domain", href: "/client/domains" },
                { label: "How to set up email accounts", href: "/client/hosting" },
                { label: "How to submit a support ticket", href: "/client/tickets" },
              ].map(g => (
                <Link key={g.label} href={g.href}
                  className="flex items-center gap-2 text-xs font-medium text-primary bg-primary/5 border border-primary/15 rounded-lg px-3 py-2 hover:bg-primary/10 transition-colors">
                  <BookOpen size={12} className="shrink-0" />
                  {g.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Returning Client (Month 2+) — Loyalty Status */}
      {isReturningClient && (
        <div className="rounded-2xl border border-amber-500/25 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(245,158,11,0.02) 100%)" }}>
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-amber-500/15" style={{ background: "rgba(245,158,11,0.08)" }}>
            <Award size={16} className="text-amber-400 shrink-0" />
            <p className="text-sm font-bold text-amber-400">Loyalty Status — {loyaltyLabel}</p>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{tenureLabel} with Noehost</span>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground mb-3">
              Thank you for your continued trust, <span className="font-semibold text-foreground">{user?.firstName}</span>! Here's a summary of your Noehost journey:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Active Services", value: stats.activeServices },
                { label: "Active Domains", value: stats.activeDomains },
                { label: "Unpaid Invoices", value: stats.unpaidInvoices },
                { label: "Support Tickets", value: stats.openTickets },
              ].map(item => (
                <div key={item.label} className="bg-card/60 rounded-xl border border-border/40 p-3 text-center">
                  <p className="text-2xl font-black text-foreground">{item.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Expiry Alerts — show when any service/domain expires within 15 days */}
      {expiryAlerts.length > 0 && (
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-orange-500/20 bg-orange-500/10">
            <AlertTriangle size={16} className="text-orange-400 shrink-0" />
            <p className="text-sm font-bold text-orange-400">
              Attention — {expiryAlerts.length} service{expiryAlerts.length > 1 ? "s" : ""} expiring soon
            </p>
          </div>
          <div className="divide-y divide-orange-500/10">
            {expiryAlerts.map((alert, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${alert.type === "Hosting" ? "bg-blue-500/10" : "bg-purple-500/10"}`}>
                    {alert.type === "Hosting" ? <Server size={14} className="text-blue-400" /> : <Globe size={14} className="text-purple-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{alert.name}</p>
                    <p className="text-xs text-muted-foreground">{alert.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    alert.daysLeft <= 3
                      ? "bg-red-500/15 text-red-400 border-red-500/30"
                      : alert.daysLeft <= 7
                        ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                        : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                  }`}>
                    {alert.daysLeft === 0 ? "Expires today!" : `${alert.daysLeft} day${alert.daysLeft === 1 ? "" : "s"} left`}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    <Link href={alert.type === "Hosting" ? "/client/hosting" : "/client/domains"} className="hover:text-primary transition-colors">
                      Renew →
                    </Link>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Credit Balance banner */}
      {creditBalance > 0 && (
        <Link href="/client/credits">
          <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-600/5 to-transparent border border-emerald-500/20 rounded-2xl p-5 flex items-center gap-4 cursor-pointer hover:border-emerald-500/40 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <Wallet size={22} className="text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Account Credits Available</p>
              <p className="text-xs text-muted-foreground">You have <span className="font-bold text-emerald-500">{formatPrice(creditBalance)}</span> available — use it to pay invoices instantly.</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold text-emerald-500">{formatPrice(creditBalance)}</p>
              <p className="text-xs text-muted-foreground">View Credits →</p>
            </div>
          </div>
        </Link>
      )}

      {/* Free Domain Notification */}
      {freeDomainService && (
        <div className="rounded-2xl p-5 flex items-center gap-4 border"
          style={{ background: "linear-gradient(135deg, #f3ebff 0%, #ede0ff 100%)", borderColor: "#818CF8" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border"
            style={{ background: "#4F46E515", borderColor: "#4F46E540" }}>
            <Gift size={22} style={{ color: "#4F46E5" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: "#4F46E5" }}>You have 1 Free Domain waiting to be claimed!</p>
            <p className="text-xs text-purple-700 mt-0.5">Your <span className="font-semibold">{freeDomainService.planName}</span> yearly plan includes a free domain registration. Claim it now before it expires.</p>
          </div>
          <button onClick={handleClaimFreeDomain}
            className="shrink-0 px-4 py-2 text-[13px] font-bold text-white rounded-xl shadow transition-all hover:opacity-90"
            style={{ background: "#4F46E5", boxShadow: "0 4px 14px rgba(112,26,254,0.28)" }}>
            Claim Now
          </button>
        </div>
      )}

      {/* Active Hosting Services Quick Access */}
      {activeServices.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/5">
          <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/30">
            <div className="flex items-center gap-2">
              <Server size={16} className="text-blue-400" />
              <h3 className="font-display font-bold text-lg">Quick Access — Active Services</h3>
            </div>
            <Link href="/client/hosting" className="text-xs text-primary hover:underline">Manage All</Link>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeServices.map(svc => {
              const isActive = svc.status === "active";
              const cpanelBusy = ssoLoading[svc.id] === "cpanel";
              const webmailBusy = ssoLoading[svc.id] === "webmail";
              const anyBusy = !!ssoLoading[svc.id];
              return (
                <div key={svc.id} className="bg-secondary/20 border border-border/60 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-foreground text-sm truncate">{svc.domain || svc.planName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{svc.planName} · {svc.billingCycle}</p>
                    {svc.nextDueDate && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Due: {format(new Date(svc.nextDueDate), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  {svc.status === "active" && <ServiceUsageWidget serviceId={svc.id} />}
                  <div className="flex gap-2">
                    {isActive && (
                      <Button size="sm" variant="outline" onClick={() => handleSsoLogin(svc.id, "cpanel")}
                        disabled={anyBusy}
                        className="flex-1 h-8 text-xs gap-1.5 border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300">
                        {cpanelBusy ? <Loader2 size={12} className="animate-spin" /> : <Terminal size={12} />}
                        cPanel
                      </Button>
                    )}
                    {isActive && (
                      <Button size="sm" variant="outline" onClick={() => handleSsoLogin(svc.id, "webmail")}
                        disabled={anyBusy}
                        className="flex-1 h-8 text-xs gap-1.5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300">
                        {webmailBusy ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                        Webmail
                      </Button>
                    )}
                    {!isActive && (
                      <Button asChild size="sm" variant="outline" className="flex-1 h-8 text-xs">
                        <Link href="/client/hosting"><ExternalLink size={12} className="mr-1" /> Details</Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Orders + Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Orders */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/5 flex flex-col">
          <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/30">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-primary" />
              <h3 className="font-display font-bold text-lg">Recent Orders</h3>
            </div>
            <Link href="/client/hosting" className="text-xs text-primary hover:underline">View Services</Link>
          </div>
          <div className="p-0 flex-1">
            {recentOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No orders yet</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <tbody>
                  {recentOrders.map(order => (
                    <tr key={order.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20">
                      <td className="p-4">
                        <p className="font-medium text-foreground text-sm truncate max-w-[160px]">{order.itemName}</p>
                        {order.domain && <p className="text-xs font-mono text-muted-foreground">{order.domain}</p>}
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">{order.type} · {order.billingCycle}</p>
                      </td>
                      <td className="p-4 text-sm font-semibold text-foreground whitespace-nowrap">{formatPrice(Number(order.amount))}</td>
                      <td className="p-4 text-right">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-medium border capitalize ${orderStatusColors[order.status] || "bg-secondary text-secondary-foreground border-border"}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/5 flex flex-col">
          <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/30">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" />
              <h3 className="font-display font-bold text-lg">Recent Invoices</h3>
            </div>
            <Link href="/client/invoices" className="text-xs text-primary hover:underline">View All</Link>
          </div>
          <div className="p-0 flex-1">
            {!stats.recentInvoices?.length ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No recent invoices</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <tbody>
                  {stats.recentInvoices.map(inv => (
                    <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 cursor-pointer group"
                      onClick={() => navigate(`/client/invoices/${inv.id}`)}>
                      <td className="p-4">
                        <p className="font-mono font-medium text-sm text-foreground group-hover:text-primary transition-colors">{inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatPrice(Number(inv.total))}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                          inv.status === "paid" ? "bg-green-50 text-green-700 border-green-200" :
                          inv.status === "unpaid" ? "bg-red-50 text-red-600 border-red-200" :
                          inv.status === "payment_pending" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          "bg-secondary text-muted-foreground border-border"
                        }`}>
                          {inv.status === "payment_pending" ? "Pending" : inv.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">View →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Recent Support Tickets */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/5">
        <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/30">
          <div className="flex items-center gap-2">
            <Ticket size={16} className="text-orange-400" />
            <h3 className="font-display font-bold text-lg">Recent Support Tickets</h3>
          </div>
          <Link href="/client/tickets" className="text-xs text-primary hover:underline">View All</Link>
        </div>
        <div className="p-0">
          <table className="w-full text-left">
            <tbody>
              {stats.recentTickets?.map(ticket => (
                <tr key={ticket.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 cursor-pointer"
                  onClick={() => navigate(`/client/tickets/${ticket.id}`)}>
                  <td className="p-4">
                    <p className="font-medium text-foreground truncate max-w-[300px]">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">#{ticket.ticketNumber}</p>
                  </td>
                  <td className="p-4 text-right">
                    <span className="px-2 py-1 bg-secondary rounded text-xs font-medium text-muted-foreground border border-border">
                      {ticket.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!stats.recentTickets?.length && (
                <tr><td colSpan={2} className="p-8 text-center text-muted-foreground">No open tickets</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    {showTour && <WelcomeTour onClose={dismissTour} />}
    </>
  );
}
