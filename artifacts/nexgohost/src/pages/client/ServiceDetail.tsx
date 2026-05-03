import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Server, Globe, Shield, Calendar, HardDrive, Activity,
  ShieldCheck, ShieldX, ExternalLink, ArrowLeft, RefreshCw,
  KeyRound, Loader2, Eye, EyeOff, CheckCircle2,
  AlertTriangle, Lock, Plus, Trash2, Pencil,
  Database, Download, ArchiveRestore, Clock, Rocket, Mail,
  Cpu, Code2, Wifi, Terminal, FolderOpen, Settings, LayoutDashboard,
  Globe2, Power, Play, Square, RotateCcw, ChevronRight, Info,
  MoreHorizontal, Boxes, AtSign, Zap, UploadCloud, FileText,
  Network, FolderPlus, Upload, ArrowUp, Home, Save, X, Plug, Palette, ArrowRight,
  Package, Sparkles, Gauge, Ghost, BookOpen, Sliders, Bot, Send, TicketCheck,
} from "lucide-react";
import { format } from "date-fns";
import { InfoTooltip } from "@/components/InfoTooltip";

// ─── Config ───────────────────────────────────────────────────────────────────
const API = "";

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const fullUrl = url.startsWith("/api") ? url : `/api${url}`;
  return fetch(fullUrl, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
}

async function apiFetch<T = any>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await authFetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Service {
  id: string; planId: string; planName: string; domain: string | null;
  status: string; billingCycle: string | null; nextDueDate: string | null;
  sslStatus: string; username: string | null; serverIp: string | null;
  cpanelUrl: string | null; webmailUrl: string | null;
  diskUsed: string | null; bandwidthUsed: string | null;
  cancelRequested: boolean; serverId: string | null;
  wpInstalled: boolean; wpUrl: string | null; wpUsername: string | null;
  wpPassword: string | null; wpEmail: string | null; wpSiteTitle: string | null;
  wpProvisionStatus: string | null; wpProvisionStep: string | null; wpProvisionError: string | null;
  autoRenew: boolean; canManage: boolean; manageLockReason: string | null;
  twentyIPackageId?: string | null;
}

interface DnsRecord { line: number; type: string; name: string; address: string; ttl: number }
interface HostingPlan { id: string; name: string; price: number; yearlyPrice?: number | null; diskSpace: string; bandwidth: string }
type NavSection = "overview" | "wordpress" | "software" | "domains" | "email" | "databases" | "files" | "ssl" | "backup" | "ssh" | "nodejs" | "python" | "environment" | "monitor" | "staging" | "ai-support";

// ─── Sidebar Nav ─────────────────────────────────────────────────────────────
const NAV_ITEMS: { id: NavSection; label: string; icon: React.ElementType; group?: string; tooltip?: string }[] = [
  { id: "overview",     label: "Overview",       icon: LayoutDashboard, group: "Hosting" },
  { id: "wordpress",    label: "WordPress",      icon: Boxes,           group: "Hosting" },
  { id: "software",     label: "Software",       icon: Package,         group: "Hosting", tooltip: "One-click installers for popular applications like WordPress, Ghost, and Node.js." },
  { id: "domains",      label: "Domains & DNS",  icon: Globe,           group: "Hosting", tooltip: "DNS (Domain Name System) translates your domain name into an IP address so browsers can find your site." },
  { id: "email",        label: "Email",          icon: Mail,            group: "Hosting" },
  { id: "databases",    label: "Databases",      icon: Database,        group: "Hosting" },
  { id: "files",        label: "File Manager",   icon: FolderOpen,      group: "Hosting" },
  { id: "ai-support",   label: "AI Specialist",   icon: Sparkles,        group: "Security", tooltip: "24/7 AI Support Specialist that reads your error logs and suggests instant fixes — or auto-creates a ticket for the support team." },
  { id: "monitor",      label: "Resource Guard",  icon: Gauge,           group: "Security", tooltip: "Real-time resource monitoring, security permission scanning, and edge/object cache controls for your hosting account." },
  { id: "ssl",          label: "SSL",             icon: ShieldCheck,     group: "Security", tooltip: "SSL (Secure Sockets Layer) encrypts data between your site and visitors — it's what enables HTTPS and the browser padlock." },
  { id: "ssh",          label: "SSH Access",      icon: Terminal,        group: "Security", tooltip: "SSH (Secure Shell) lets you connect directly to your server via a command-line terminal for advanced management." },
  { id: "staging",      label: "Staging & Clone", icon: Rocket,          group: "Tools", tooltip: "Create a full 1-click copy of your live site for safe testing, then push it back to production with one click." },
  { id: "backup",       label: "Backups",        icon: ArchiveRestore,  group: "Tools" },
  { id: "environment",  label: "Environment",    icon: Sliders,         group: "Tools", tooltip: "Switch PHP and runtime versions for your hosting account with one click." },
  { id: "nodejs",       label: "Node.js",        icon: Code2,           group: "Tools" },
  { id: "python",       label: "Python",         icon: Cpu,             group: "Tools" },
];

function Sidebar({ active, onChange, service }: { active: NavSection; onChange: (s: NavSection) => void; service: Service | null }) {
  const groups = Array.from(new Set(NAV_ITEMS.map(n => n.group!)));
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-background flex flex-col">
      <div className="p-4 border-b border-border">
        <p className="font-semibold text-foreground truncate text-sm">{service?.domain || "Hosting"}</p>
        <StatusBadge status={service?.status || "pending"} />
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {groups.map(group => (
          <div key={group} className="mb-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">{group}</p>
            {NAV_ITEMS.filter(n => n.group === group).map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => onChange(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                    active === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}>
                  <Icon size={15} className="shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.tooltip && <InfoTooltip text={item.tooltip} />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

// ─── Shared UI Components ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { dot: string; badge: string; label: string }> = {
    active:    { dot: "bg-emerald-500", badge: "bg-[#D1FAE5] text-[#065F46]", label: "Active" },
    suspended: { dot: "bg-orange-400",  badge: "bg-orange-50 text-orange-700", label: "Suspended" },
    terminated:{ dot: "bg-red-400",     badge: "bg-red-50 text-red-700",       label: "Terminated" },
    pending:   { dot: "bg-yellow-400",  badge: "bg-yellow-50 text-yellow-700", label: "Pending" },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${c.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function SvgRing({ pct, size = 100, stroke = 8, color, label, used, limit, unlimited, loading }: {
  pct: number; size?: number; stroke?: number; color: string;
  label: string; used: string; limit: string; unlimited?: boolean; loading?: boolean;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  const cx = size / 2;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(var(--border))" strokeWidth={stroke} />
          {!unlimited && <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={loading ? circ : offset}
            style={{ transition: "stroke-dashoffset 1s ease" }} />}
          {unlimited && <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray="6 4" opacity={0.4} />}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {loading ? <Loader2 size={14} className="animate-spin text-muted-foreground" />
            : <span className="text-base font-bold text-foreground">{unlimited ? "∞" : `${Math.round(pct)}%`}</span>}
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{unlimited ? "Unlimited" : `${used} / ${limit}`}</p>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-xl p-5 ${className}`}>{children}</div>;
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon size={22} className="text-muted-foreground" />
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>
    </div>
  );
}

function NotAvailable({ reason }: { reason: string }) {
  return (
    <Card className="flex items-start gap-3">
      <Info size={18} className="text-muted-foreground shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-foreground">Not available</p>
        <p className="text-sm text-muted-foreground mt-0.5">{reason}</p>
      </div>
    </Card>
  );
}

function MgmtUnavailable({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const m = message.toLowerCase();
  const isNoServer = m.includes("no whm") || m.includes("no cpanel");
  const isNoUser = m.includes("username") || m.includes("no cpanel username")
    || m.includes("user parameter") || m.includes("user is invalid") || m.includes("invalid user");
  const is20i = m.includes("20i");
  const isStatus = m.includes("management unavailable");
  const isAuth = m.includes("invalid api token") || m.includes("access denied") || m.includes("401") || m.includes("403");

  const title = isStatus ? "Service not active"
    : is20i ? "Not available for this plan"
    : isNoUser ? "Account not provisioned"
    : isNoServer ? "Server not configured"
    : isAuth ? "Server authentication error"
    : "Management unavailable";

  const detail = isStatus
    ? "This service is not in an active state. Management features are only available for active services."
    : is20i
    ? "This feature is managed through the 20i control panel. Contact support for assistance."
    : isNoUser
    ? "This hosting account has not been fully provisioned on the server yet. Please contact support to complete setup."
    : isNoServer
    ? "No WHM/cPanel server is linked to this account. Please contact support."
    : isAuth
    ? "The server API token is invalid or lacks permission. Please contact support to re-link the server credentials."
    : message;

  return (
    <Card className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
        <AlertTriangle size={19} className="text-amber-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{detail}</p>
        <div className="flex items-center gap-3 mt-3">
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
              <RefreshCw size={12} /> Retry
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => window.location.href = "/client/support/new"}
            className="gap-1.5 text-muted-foreground">
            <TicketCheck size={12} /> Contact Support
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function SectionOverview({ service, plan, navigateTo }: { service: Service; plan: HostingPlan | null; navigateTo: (s: NavSection) => void }) {
  const { formatPrice } = useCurrency();
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    authFetch(`/client/hosting/${service.id}/usage`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setUsage(d))
      .catch(() => null);
  }, [service.id]);

  const diskLimit = plan?.diskSpace ?? "10 GB";
  const bwLimit = plan?.bandwidth ?? "100 GB";
  const diskUsed = usage?.diskUsed ?? service.diskUsed ?? "0 MB";
  const bwUsed = usage?.bwUsed ?? service.bandwidthUsed ?? "0 MB";
  const diskPct = usage?.diskPct ?? 0;
  const bwPct = usage?.bwPct ?? 0;
  const diskUnlimited = usage?.diskUnlimited ?? diskLimit.toLowerCase().includes("unlimited");
  const bwUnlimited = usage?.bwUnlimited ?? bwLimit.toLowerCase().includes("unlimited");

  return (
    <div className="space-y-5">
      <SectionHeader title="Hosting Overview" description="Your hosting service at a glance" />

      {/* Quick Actions — navigate to internal panel sections */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: "File Manager",  icon: FolderOpen,  section: "files"       as NavSection, color: "text-blue-600 bg-blue-50" },
          { label: "Email",         icon: Mail,        section: "email"       as NavSection, color: "text-emerald-600 bg-emerald-50" },
          { label: "Databases",     icon: Database,    section: "databases"   as NavSection, color: "text-amber-600 bg-amber-50" },
          { label: "WordPress",     icon: Globe,       section: "wordpress"   as NavSection, color: "text-violet-600 bg-violet-50" },
          { label: "Software",      icon: Package,     section: "software"    as NavSection, color: "text-indigo-600 bg-indigo-50" },
          { label: "Environment",   icon: Sliders,     section: "environment" as NavSection, color: "text-orange-600 bg-orange-50" },
          { label: "Node.js",       icon: Code2,       section: "nodejs"      as NavSection, color: "text-green-600 bg-green-50" },
          { label: "SSL",           icon: ShieldCheck, section: "ssl"         as NavSection, color: "text-teal-600 bg-teal-50" },
        ] as const).map(a => (
          <button key={a.section} onClick={() => navigateTo(a.section)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors cursor-pointer">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.color}`}>
              <a.icon size={18} />
            </div>
            <span className="text-xs font-medium text-foreground">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Resource Usage */}
      <Card>
        <h3 className="font-semibold text-foreground mb-5">Resource Usage</h3>
        <div className="flex gap-8 flex-wrap">
          <SvgRing pct={diskPct} color="#7C3AED" label="Disk" used={diskUsed} limit={diskLimit} unlimited={diskUnlimited} />
          <SvgRing pct={bwPct} color="#2563EB" label="Bandwidth" used={bwUsed} limit={bwLimit} unlimited={bwUnlimited} />
        </div>
      </Card>

      {/* Service Info */}
      <Card>
        <h3 className="font-semibold text-foreground mb-4">Service Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {[
            { label: "Domain", value: service.domain || "—" },
            { label: "Plan", value: service.planName },
            { label: "Status", value: <StatusBadge status={service.status} /> },
            { label: "Billing Cycle", value: service.billingCycle ?? "—" },
            { label: "Next Due", value: service.nextDueDate ? format(new Date(service.nextDueDate), "MMM d, yyyy") : "—" },
            { label: "IP Address", value: service.serverIp ?? "—" },
            { label: "Username", value: service.username ?? "—" },
            { label: "SSL", value: ["active", "installed"].includes(service.sslStatus) ? "Active ✓" : "Not installed", tooltip: "Secure Sockets Layer — encrypts traffic between your visitors and your server, enabling the padlock in the browser." },
          ].map(row => (
            <div key={row.label} className="flex justify-between border-b border-border pb-2 last:border-0">
              <span className="text-muted-foreground flex items-center">
                {row.label}
                {"tooltip" in row && row.tooltip && <InfoTooltip text={row.tooltip} />}
              </span>
              <span className="font-medium text-foreground">{row.value as any}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: WORDPRESS
// ═══════════════════════════════════════════════════════════════════════════════
function SectionWordPress({ service, refetch }: { service: Service; refetch: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [wpStatus, setWpStatus] = useState({
    status: service.wpProvisionStatus,
    step: service.wpProvisionStep,
    error: service.wpProvisionError,
  });
  const [checkDomain, setCheckDomain] = useState(service.domain ?? "");
  const [installForm, setInstallForm] = useState({ siteTitle: "", adminUser: "", adminEmail: service.wpEmail ?? "", domain: service.domain ?? "" });
  const [showInstallForm, setShowInstallForm] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);

  useEffect(() => {
    authFetch(`/client/hosting/${service.id}/domains`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.domains) setDomains([...(d.domains.mainDomain ? [d.domains.mainDomain] : []), ...(d.domains.addons ?? []), ...(d.domains.subdomains ?? [])]);
    }).catch(() => null);
  }, [service.id]);

  async function handleInstall() {
    setLoading("install");
    try {
      const res = await authFetch(`/client/hosting/${service.id}/install-wordpress`, {
        method: "POST", body: JSON.stringify({ ...installForm }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Install failed");
      toast({ title: "WordPress installation started", description: "This may take a few minutes." });
      setShowInstallForm(false);
      pollWpStatus();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setLoading(null); }
  }

  function pollWpStatus() {
    const iv = setInterval(async () => {
      const d = await apiFetch(`/client/hosting/${service.id}/wordpress-status`).catch(() => null);
      if (d) {
        setWpStatus({ status: d.status, step: d.step, error: d.error });
        if (["installed", "failed"].includes(d.status)) { clearInterval(iv); refetch(); }
      }
    }, 3000);
  }

  async function handleWpAdmin() {
    setLoading("wpadmin");
    try {
      const d = await apiFetch(`/client/hosting/${service.id}/wp-admin-url`, { method: "POST", body: JSON.stringify({ domain: checkDomain }) });
      if (d.url) window.open(d.url, "_blank", "noopener");
      else toast({ title: "WordPress Admin", description: `Visit: https://${checkDomain}/wp-admin`, variant: "default" });
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setLoading(null); }
  }

  const isProvisioning = ["provisioning", "queued"].includes(wpStatus.status ?? "");
  const isInstalled = service.wpInstalled || wpStatus.status === "installed";

  async function openWpDeepLink(target: string) {
    setLoading(`wp-deep-${target}`);
    try {
      const res = await authFetch(`/client/hosting/${service.id}/wp/sso-deep?target=${target}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      if (d.url) window.open(d.url, "_blank", "noopener");
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setLoading(null); }
  }

  if (isInstalled) {
    return (
      <div className="space-y-5">
        <SectionHeader title="WordPress" description="Manage your WordPress installation" />
        <Card>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Boxes size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{service.wpSiteTitle || "WordPress Site"}</p>
              <p className="text-sm text-muted-foreground">{service.wpUrl || service.domain}</p>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open(service.wpUrl || `https://${service.domain}`, "_blank")} className="gap-1.5">
                <ExternalLink size={13} /> Visit Site
              </Button>
              <Button size="sm" onClick={handleWpAdmin} disabled={!!loading} className="gap-1.5 bg-primary hover:bg-primary/90">
                {loading === "wpadmin" ? <Loader2 size={13} className="animate-spin" /> : <Settings size={13} />} WP Admin
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {service.wpUsername && <div className="bg-muted rounded-lg p-3"><p className="text-muted-foreground text-xs">Admin User</p><p className="font-medium mt-0.5">{service.wpUsername}</p></div>}
            {service.wpEmail && <div className="bg-muted rounded-lg p-3"><p className="text-muted-foreground text-xs">Admin Email</p><p className="font-medium mt-0.5">{service.wpEmail}</p></div>}
          </div>
        </Card>

        {/* Plugin & Theme Manager */}
        <Card>
          <h3 className="font-semibold text-foreground mb-1">Plugin Manager</h3>
          <p className="text-sm text-muted-foreground mb-4">Install, activate, or remove plugins directly from your WordPress admin.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[
              { name: "WooCommerce", desc: "E-commerce" },
              { name: "Yoast SEO", desc: "SEO" },
              { name: "Contact Form 7", desc: "Forms" },
              { name: "Elementor", desc: "Page Builder" },
              { name: "WP Rocket", desc: "Caching" },
              { name: "Akismet", desc: "Anti-spam" },
              { name: "UpdraftPlus", desc: "Backup" },
              { name: "Wordfence", desc: "Security" },
            ].map(p => (
              <div key={p.name} className="border border-border rounded-lg p-2.5 text-center">
                <Plug size={14} className="text-muted-foreground mx-auto mb-1" />
                <p className="text-xs font-medium text-foreground leading-tight">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
          <Button onClick={() => openWpDeepLink("plugins")} disabled={!!loading} className="gap-2 bg-primary hover:bg-primary/90">
            {loading === "wp-deep-plugins" ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
            Manage Plugins in WP Admin
          </Button>
        </Card>

        <Card>
          <h3 className="font-semibold text-foreground mb-1">Theme Manager</h3>
          <p className="text-sm text-muted-foreground mb-4">Switch your site theme or install a new one.</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {["Astra", "OceanWP", "GeneratePress", "Neve", "Hello Elementor", "Kadence"].map(t => (
              <div key={t} className="border border-border rounded-lg p-2.5 text-center">
                <Palette size={14} className="text-muted-foreground mx-auto mb-1" />
                <p className="text-xs font-medium text-foreground leading-tight">{t}</p>
              </div>
            ))}
          </div>
          <Button onClick={() => openWpDeepLink("themes")} disabled={!!loading} variant="outline" className="gap-2">
            {loading === "wp-deep-themes" ? <Loader2 size={14} className="animate-spin" /> : <Palette size={14} />}
            Manage Themes in WP Admin
          </Button>
        </Card>
      </div>
    );
  }

  if (isProvisioning) {
    return (
      <div className="space-y-5">
        <SectionHeader title="WordPress" />
        <Card className="flex items-center gap-4">
          <Loader2 size={24} className="animate-spin text-primary shrink-0" />
          <div>
            <p className="font-semibold text-foreground">Installing WordPress...</p>
            <p className="text-sm text-muted-foreground mt-0.5">{wpStatus.step || "This may take a few minutes."}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="WordPress" description="Install WordPress with one click" />
      {!showInstallForm ? (
        <Card>
          <EmptyState icon={Boxes} title="WordPress not installed" description="Install WordPress to get a full CMS for your website." />
          <div className="flex justify-center mt-4 gap-3">
            <Button onClick={() => setShowInstallForm(true)} className="gap-2 bg-primary hover:bg-primary/90">
              <Plus size={15} /> Install WordPress
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <h3 className="font-semibold text-foreground mb-4">Install WordPress</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Domain</label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                value={installForm.domain} onChange={e => setInstallForm(f => ({ ...f, domain: e.target.value }))}>
                {(domains.length ? domains : [service.domain || ""]).filter(Boolean).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Site Title</label>
              <Input placeholder="My Website" value={installForm.siteTitle} onChange={e => setInstallForm(f => ({ ...f, siteTitle: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Admin Username</label>
              <Input placeholder="admin" value={installForm.adminUser} onChange={e => setInstallForm(f => ({ ...f, adminUser: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Admin Email</label>
              <Input placeholder="admin@yourdomain.com" value={installForm.adminEmail} onChange={e => setInstallForm(f => ({ ...f, adminEmail: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleInstall} disabled={loading === "install"} className="gap-2 bg-primary hover:bg-primary/90">
                {loading === "install" ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />} Install
              </Button>
              <Button variant="outline" onClick={() => setShowInstallForm(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
function MailToggle({ checked, onChange, loading }: { checked: boolean; onChange: (v: boolean) => void; loading?: boolean }) {
  return (
    <button
      onClick={() => !loading && onChange(!checked)}
      disabled={loading}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none disabled:opacity-50 cursor-pointer"
      style={{ background: checked ? "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)" : "rgba(0,0,0,0.15)" }}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function SectionEmail({ service }: { service: Service }) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [mgmtError, setMgmtError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", quota: "250" });
  const [showPwd, setShowPwd] = useState(false);
  const [changePwd, setChangePwd] = useState<{ email: string; pwd: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<string | null>(null);
  const [emailSettings, setEmailSettings] = useState<Record<string, { spamFilter: boolean; autoForward: boolean; forwardTo: string }>>({});
  const [savingSettings, setSavingSettings] = useState<string | null>(null);
  const [webmailLoading, setWebmailLoading] = useState<string | null>(null);

  const isWHM = !service.twentyIPackageId && service.serverId;

  async function loadAccounts() {
    setLoadingList(true);
    setMgmtError(null);
    try {
      const d = await apiFetch(`/client/hosting/${service.id}/email`);
      setAccounts(d.accounts || []);
    } catch (e: any) { setMgmtError(e.message); }
    finally { setLoadingList(false); }
  }

  async function loadSettings() {
    try {
      const d = await apiFetch(`/client/hosting/${service.id}/email/settings`);
      const map: Record<string, { spamFilter: boolean; autoForward: boolean; forwardTo: string }> = {};
      for (const s of (d.settings || [])) {
        map[s.email] = { spamFilter: s.spamFilter ?? true, autoForward: s.autoForward ?? false, forwardTo: s.forwardTo || "" };
      }
      setEmailSettings(map);
    } catch {}
  }

  useEffect(() => {
    if (isWHM) { loadAccounts(); loadSettings(); } else setLoadingList(false);
  }, [service.id]);

  async function handleCreate() {
    if (!form.email.includes("@")) return toast({ description: "Include the full email address with @domain", variant: "destructive" });
    setCreating(true);
    try {
      await apiFetch(`/client/hosting/${service.id}/email`, { method: "POST", body: JSON.stringify({ email: form.email, password: form.password, quota: Number(form.quota) }) });
      toast({ title: "Email account created", description: form.email });
      setForm({ email: "", password: "", quota: "250" }); setShowCreate(false); loadAccounts();
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setCreating(false); }
  }

  async function handleDelete(email: string) {
    setDeleting(email);
    try {
      await apiFetch(`/client/hosting/${service.id}/email`, { method: "DELETE", body: JSON.stringify({ email }) });
      toast({ title: "Deleted", description: `${email} has been removed` });
      loadAccounts();
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setDeleting(null); }
  }

  async function handleWebmail() {
    try {
      const d = await apiFetch(`/client/hosting/${service.id}/email/webmail`, { method: "POST" });
      if (d.url) window.open(d.url, "_blank", "noopener");
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
  }

  async function handleWebmailFor(email: string) {
    setWebmailLoading(email);
    try {
      const d = await apiFetch(`/client/hosting/${service.id}/email/webmail`, { method: "POST", body: JSON.stringify({ email }) });
      if (d.url) window.open(d.url, "_blank", "noopener");
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setWebmailLoading(null); }
  }

  async function handleChangePwd() {
    if (!changePwd) return;
    try {
      await apiFetch(`/client/hosting/${service.id}/email/password`, { method: "PUT", body: JSON.stringify({ email: changePwd.email, password: changePwd.pwd }) });
      toast({ title: "Password updated" }); setChangePwd(null);
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
  }

  async function handleToggleSetting(email: string, key: "spamFilter" | "autoForward", value: boolean) {
    const current = emailSettings[email] ?? { spamFilter: true, autoForward: false, forwardTo: "" };
    const updated = { ...current, [key]: value };
    setEmailSettings(prev => ({ ...prev, [email]: updated }));
    setSavingSettings(email + key);
    try {
      await apiFetch(`/client/hosting/${service.id}/email/settings/${encodeURIComponent(email)}`, {
        method: "PUT", body: JSON.stringify(updated),
      });
    } catch (e: any) {
      setEmailSettings(prev => ({ ...prev, [email]: current }));
      toast({ description: e.message, variant: "destructive" });
    }
    setSavingSettings(null);
  }

  async function handleSaveForwardTo(email: string, forwardTo: string) {
    const current = emailSettings[email] ?? { spamFilter: true, autoForward: false, forwardTo: "" };
    const updated = { ...current, forwardTo };
    setSavingSettings(email + "forwardTo");
    try {
      await apiFetch(`/client/hosting/${service.id}/email/settings/${encodeURIComponent(email)}`, {
        method: "PUT", body: JSON.stringify(updated),
      });
      toast({ title: "Forwarding address saved" });
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    setSavingSettings(null);
  }

  if (!isWHM) return <NotAvailable reason="Email management is available on WHM/cPanel servers. This hosting account uses a different server type — contact support for help." />;

  if (mgmtError) return (
    <div className="space-y-5">
      <SectionHeader title="Email Accounts" description="Manage email accounts for your hosting" />
      <MgmtUnavailable message={mgmtError} onRetry={() => { loadAccounts(); loadSettings(); }} />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ── Mail Central Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)" }}>
            <Mail size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-lg leading-tight">Mail Central</h3>
            <p className="text-xs text-muted-foreground">
              {loadingList ? "Loading…" : `${accounts.length} account${accounts.length !== 1 ? "s" : ""}`}
              {service.domain ? ` · ${service.domain}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleWebmail}
            className="gap-1.5 text-primary border-primary/30 hover:bg-primary/5">
            <Globe2 size={13} /> Quick Webmail
          </Button>
          <Button size="sm" onClick={() => setShowCreate(s => !s)}
            className="gap-1.5 bg-primary hover:bg-primary/90">
            <Plus size={13} /> Create Email
          </Button>
        </div>
      </div>

      {/* ── Create Form ── */}
      {showCreate && (
        <Card>
          <h3 className="font-semibold text-foreground mb-4">New Email Account</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email Address</label>
              <Input placeholder={`info@${service.domain || "yourdomain.com"}`} value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Password</label>
                <div className="relative">
                  <Input type={showPwd ? "text" : "password"} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  <button type="button" onClick={() => setShowPwd(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Quota (MB)</label>
                <Input type="number" value={form.quota} onChange={e => setForm(f => ({ ...f, quota: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleCreate} disabled={creating} className="gap-2 bg-primary hover:bg-primary/90">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Email Table ── */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        {loadingList ? (
          <div className="flex justify-center py-14">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="relative overflow-hidden p-8"
            style={{ background: "linear-gradient(135deg, rgba(79,70,229,0.04) 0%, rgba(99,102,241,0.02) 100%)" }}>
            <div className="absolute top-0 right-0 w-40 h-40 opacity-[0.04]"
              style={{ background: "radial-gradient(circle, #6366F1 0%, transparent 70%)", transform: "translate(20%, -20%)" }} />
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                style={{ background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)" }}>
                <AtSign size={24} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-base leading-snug">
                  Professionalize your brand with custom email
                  {service.domain && <> for <span className="text-primary font-mono">{service.domain}</span></>}
                </p>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Clients remember <span className="font-medium text-foreground">you@{service.domain || "yourdomain.com"}</span> more than a generic inbox.
                </p>
                <div className="flex items-center gap-4 mt-4 flex-wrap">
                  {[["Spam-filtered inbox", "emerald"], ["Webmail access", "indigo"], ["Multiple addresses", "amber"]].map(([label]) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck size={12} className="text-primary opacity-60" /> {label}
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowCreate(true)}
                  className="mt-5 inline-flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-semibold text-white shadow-md hover:opacity-90 transition-opacity"
                  style={{ background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)" }}>
                  <Plus size={14} /> Create Your First Email
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid items-center px-5 py-3 border-b border-border bg-secondary/40"
              style={{ gridTemplateColumns: "1fr 90px 80px 80px 152px" }}>
              {["Email Address", "Quota", "Spam", "Forward", ""].map((h, i) => (
                <span key={i} className={`text-[10px] font-bold text-muted-foreground uppercase tracking-wider ${i === 4 ? "text-right" : ""}`}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {accounts.map(acc => {
              const settings = emailSettings[acc.email] ?? { spamFilter: true, autoForward: false, forwardTo: "" };
              const isOpen = settingsOpen === acc.email;
              return (
                <div key={acc.email} className="border-b border-border last:border-0">
                  {/* Main row */}
                  <div
                    className={`flex sm:grid items-center gap-3 px-5 py-4 flex-wrap transition-colors ${isOpen ? "bg-primary/[0.025]" : "hover:bg-secondary/30"}`}
                    style={{ gridTemplateColumns: "1fr 90px 80px 80px 152px" }}
                  >
                    {/* Email avatar + info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                        style={{ background: "linear-gradient(135deg, rgba(79,70,229,0.15), rgba(99,102,241,0.1))", color: "#6366F1" }}>
                        {acc.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{acc.email}</p>
                        <p className="text-xs text-muted-foreground">{acc.diskused || "0 MB"} used</p>
                      </div>
                    </div>

                    {/* Quota */}
                    <span className="text-xs font-medium text-muted-foreground bg-secondary/60 border border-border px-2 py-1 rounded-lg shrink-0 hidden sm:inline-block">
                      {acc.diskquota || "∞"}
                    </span>

                    {/* Spam badge */}
                    <div className="hidden sm:block">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={settings.spamFilter
                          ? { background: "rgba(34,197,94,0.10)", backdropFilter: "blur(8px)", boxShadow: "0 0 8px rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.28)", color: "#4ade80" }
                          : { background: "rgba(239,68,68,0.08)", backdropFilter: "blur(8px)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                        <Shield size={9} /> {settings.spamFilter ? "ON" : "OFF"}
                      </span>
                    </div>

                    {/* Forward badge */}
                    <div className="hidden sm:block">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={settings.autoForward
                          ? { background: "rgba(59,130,246,0.10)", backdropFilter: "blur(8px)", boxShadow: "0 0 8px rgba(59,130,246,0.18)", border: "1px solid rgba(59,130,246,0.28)", color: "#60a5fa" }
                          : { background: "rgba(255,255,255,0.04)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.10)", color: "#6b7280" }}>
                        {settings.autoForward ? "ON" : "OFF"}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 justify-end ml-auto sm:ml-0">
                      <button onClick={() => handleWebmailFor(acc.email)} disabled={webmailLoading === acc.email}
                        title="Quick Login to Webmail"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40">
                        {webmailLoading === acc.email ? <Loader2 size={13} className="animate-spin" /> : <Globe2 size={13} />}
                      </button>
                      <button onClick={() => setSettingsOpen(isOpen ? null : acc.email)} title="Mail Settings"
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isOpen ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}>
                        <Settings size={13} />
                      </button>
                      <button onClick={() => setChangePwd({ email: acc.email, pwd: "" })} title="Change Password"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                        <KeyRound size={13} />
                      </button>
                      <button onClick={() => handleDelete(acc.email)} disabled={deleting === acc.email} title="Delete"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40">
                        {deleting === acc.email ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>

                  {/* ── Mail Settings Panel ── */}
                  {isOpen && (
                    <div className="border-b border-border px-5 py-5"
                      style={{ background: "linear-gradient(135deg, rgba(79,70,229,0.03) 0%, rgba(99,102,241,0.015) 100%)" }}>
                      <div className="flex items-center gap-2 mb-4">
                        <Settings size={13} className="text-primary" />
                        <p className="text-sm font-bold text-foreground">Mail Settings</p>
                        <span className="text-xs text-muted-foreground font-mono">— {acc.email}</span>
                        {savingSettings?.startsWith(acc.email) && (
                          <Loader2 size={12} className="animate-spin text-primary ml-auto" />
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Spam Protection */}
                        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/60"
                          style={{ backdropFilter: "blur(8px)" }}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                              style={settings.spamFilter
                                ? { background: "rgba(34,197,94,0.12)", boxShadow: "0 0 10px rgba(34,197,94,0.2)" }
                                : { background: "rgba(239,68,68,0.08)" }}>
                              <Shield size={16} className={settings.spamFilter ? "text-emerald-400" : "text-red-400"} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">Spam Protection</p>
                              <p className="text-xs text-muted-foreground">Block junk mail automatically</p>
                            </div>
                          </div>
                          <MailToggle
                            checked={settings.spamFilter}
                            loading={savingSettings === acc.email + "spamFilter"}
                            onChange={v => handleToggleSetting(acc.email, "spamFilter", v)}
                          />
                        </div>

                        {/* Auto-Forwarding */}
                        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/60"
                          style={{ backdropFilter: "blur(8px)" }}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                              style={settings.autoForward
                                ? { background: "rgba(59,130,246,0.12)", boxShadow: "0 0 10px rgba(59,130,246,0.2)" }
                                : { background: "rgba(255,255,255,0.05)" }}>
                              <ArrowRight size={16} className={settings.autoForward ? "text-blue-400" : "text-muted-foreground"} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">Auto-Forwarding</p>
                              <p className="text-xs text-muted-foreground">Forward mail to another address</p>
                            </div>
                          </div>
                          <MailToggle
                            checked={settings.autoForward}
                            loading={savingSettings === acc.email + "autoForward"}
                            onChange={v => handleToggleSetting(acc.email, "autoForward", v)}
                          />
                        </div>
                      </div>

                      {/* Forward-to address */}
                      {settings.autoForward && (
                        <div className="mt-4">
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                            <ArrowRight size={11} /> Forward all mail to
                          </label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="recipient@example.com"
                              value={settings.forwardTo}
                              onChange={e => setEmailSettings(prev => ({ ...prev, [acc.email]: { ...settings, forwardTo: e.target.value } }))}
                              className="flex-1 bg-card"
                            />
                            <Button size="sm"
                              onClick={() => handleSaveForwardTo(acc.email, settings.forwardTo)}
                              disabled={savingSettings === acc.email + "forwardTo"}
                              className="bg-primary hover:bg-primary/90 gap-1.5">
                              {savingSettings === acc.email + "forwardTo" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                              Save
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Change password */}
      {changePwd && (
        <Card>
          <h3 className="font-semibold text-foreground mb-3">Change Password — {changePwd.email}</h3>
          <div className="flex gap-2">
            <Input type="password" placeholder="New password" value={changePwd.pwd}
              onChange={e => setChangePwd(c => c ? { ...c, pwd: e.target.value } : null)} className="flex-1" />
            <Button onClick={handleChangePwd} disabled={!changePwd.pwd} className="bg-primary hover:bg-primary/90">Update</Button>
            <Button variant="outline" onClick={() => setChangePwd(null)}>Cancel</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: DATABASES
// ═══════════════════════════════════════════════════════════════════════════════
function SectionDatabases({ service }: { service: Service }) {
  const { toast } = useToast();
  const [dbs, setDbs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mgmtError, setMgmtError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ suffix: "", password: "" });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pmaLoading, setPmaLoading] = useState(false);

  const isWHM = !service.twentyIPackageId && service.serverId;

  async function loadDbs() {
    setLoading(true);
    setMgmtError(null);
    try { const d = await apiFetch(`/client/hosting/${service.id}/databases`); setDbs(d.databases || []); }
    catch (e: any) { setMgmtError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (isWHM) loadDbs(); else setLoading(false); }, [service.id]);

  async function handleCreate() {
    if (!form.suffix.trim() || !form.password.trim()) return toast({ description: "Database name and password are required", variant: "destructive" });
    setCreating(true);
    try {
      const d = await apiFetch(`/client/hosting/${service.id}/databases`, { method: "POST", body: JSON.stringify(form) });
      toast({ title: "Database created", description: `${d.database} / user: ${d.dbUser}` });
      setForm({ suffix: "", password: "" }); setShowCreate(false); loadDbs();
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setCreating(false); }
  }

  async function handleDelete(dbname: string) {
    setDeleting(dbname);
    try {
      await apiFetch(`/client/hosting/${service.id}/databases/${encodeURIComponent(dbname)}`, { method: "DELETE" });
      toast({ title: "Database deleted" }); loadDbs();
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setDeleting(null); }
  }

  async function handlePhpMyAdmin() {
    setPmaLoading(true);
    try {
      const d = await apiFetch(`/client/hosting/${service.id}/databases/phpmyadmin`, { method: "POST" });
      if (d.url) window.open(d.url, "_blank", "noopener");
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setPmaLoading(false); }
  }

  if (!isWHM) return <NotAvailable reason="Database management is available on WHM/cPanel servers. This hosting account uses a different server type — contact support for assistance." />;

  if (mgmtError) return (
    <div className="space-y-5">
      <SectionHeader title="Databases" description="MySQL databases for your hosting account" />
      <MgmtUnavailable message={mgmtError} onRetry={loadDbs} />
    </div>
  );

  return (
    <div className="space-y-5">
      <SectionHeader title="Databases" description="MySQL databases for your hosting account"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePhpMyAdmin} disabled={pmaLoading} className="gap-1.5">
              {pmaLoading ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />} phpMyAdmin
            </Button>
            <Button size="sm" onClick={() => setShowCreate(s => !s)} className="gap-1.5 bg-primary hover:bg-primary/90"><Plus size={13} />Create Database</Button>
          </div>
        } />

      {showCreate && (
        <Card>
          <h3 className="font-semibold text-foreground mb-4">Create Database</h3>
          <p className="text-xs text-muted-foreground mb-3">Database and user will be named <code className="bg-muted px-1 rounded">{service.username}_{"{name}"}</code></p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Database Name</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">{service.username}_</span>
                <Input placeholder="mydb" value={form.suffix} onChange={e => setForm(f => ({ ...f, suffix: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">DB User Password</label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleCreate} disabled={creating} className="gap-2 bg-primary hover:bg-primary/90">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
        ) : dbs.length === 0 ? (
          <EmptyState icon={Database} title="No databases" description="Create your first MySQL database above" />
        ) : (
          <div className="divide-y divide-border">
            {dbs.map(db => (
              <div key={db.database} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                    <Database size={14} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{db.database}</p>
                    <p className="text-xs text-muted-foreground">{db.users?.join(", ") || "No users"}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(db.database)} disabled={deleting === db.database}
                  className="text-destructive hover:text-destructive">
                  {deleting === db.database ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: FILES
// ═══════════════════════════════════════════════════════════════════════════════
type FsItem = { file: string; type: "file" | "dir"; size: number; mtime: number; humansize: string; permissions: string; mime?: string; fullpath: string };

function fileIcon(item: FsItem) {
  if (item.type === "dir") return <FolderOpen size={16} className="text-yellow-500 shrink-0" />;
  const ext = item.file.split(".").pop()?.toLowerCase() ?? "";
  if (["js","ts","jsx","tsx","mjs","cjs"].includes(ext)) return <Code2 size={16} className="text-yellow-400 shrink-0" />;
  if (["html","htm","css","scss","sass"].includes(ext)) return <Globe2 size={16} className="text-blue-500 shrink-0" />;
  if (["php","py","rb","go","java","c","cpp","rs"].includes(ext)) return <Terminal size={16} className="text-green-500 shrink-0" />;
  if (["jpg","jpeg","png","gif","webp","svg","ico"].includes(ext)) return <Zap size={16} className="text-pink-500 shrink-0" />;
  if (["zip","tar","gz","bz2","7z","rar"].includes(ext)) return <Download size={16} className="text-orange-500 shrink-0" />;
  if (["sql","db","sqlite"].includes(ext)) return <Database size={16} className="text-purple-500 shrink-0" />;
  return <FileText size={16} className="text-muted-foreground shrink-0" />;
}

const TEXT_EXTS = new Set(["txt","html","htm","css","scss","sass","js","ts","jsx","tsx","mjs","cjs","json","xml","svg","php","py","rb","go","java","c","cpp","rs","sh","bash","md","env","ini","conf","yaml","yml","htaccess","log","csv"]);

function SectionFiles({ service }: { service: Service }) {
  const { toast } = useToast();
  const isWHM = !service.twentyIPackageId;

  const [currentPath, setCurrentPath] = useState("public_html");
  const [items, setItems] = useState<FsItem[]>([]);
  const [loadingDir, setLoadingDir] = useState(false);
  const [mgmtError, setMgmtError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editFile, setEditFile] = useState<{ path: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showMkdir, setShowMkdir] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [mkdiring, setMkdiring] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const isInitialLoad = useRef(true);

  async function loadDir(path: string) {
    setLoadingDir(true);
    setIsSyncing(false);
    try {
      const res = await authFetch(`/client/hosting/${service.id}/files?path=${encodeURIComponent(path)}`);
      const d = await res.json();
      if (res.status === 503 && d.syncing) {
        setIsSyncing(true);
        setMgmtError(null);
        return;
      }
      if (!res.ok) throw new Error(d.error || "Failed to list directory");
      setItems(d.items || []);
      setCurrentPath(path);
      setMgmtError(null);
      setIsSyncing(false);
    } catch (e: any) {
      if (isInitialLoad.current) setMgmtError(e.message);
      else toast({ description: e.message, variant: "destructive" });
    }
    finally { setLoadingDir(false); isInitialLoad.current = false; }
  }

  useEffect(() => { isInitialLoad.current = true; if (isWHM) loadDir("public_html"); }, [service.id]);

  function navigateTo(path: string) { setEditFile(null); loadDir(path); }

  function navigateUp() {
    const parts = currentPath.split("/").filter(Boolean);
    if (parts.length <= 1) return;
    navigateTo(parts.slice(0, -1).join("/"));
  }

  async function openFile(item: FsItem) {
    const ext = item.file.split(".").pop()?.toLowerCase() ?? "";
    if (!TEXT_EXTS.has(ext)) return toast({ description: "Binary files cannot be edited in browser." });
    try {
      const res = await authFetch(`/client/hosting/${service.id}/files/content?path=${encodeURIComponent(item.fullpath)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setEditFile({ path: item.fullpath, content: d.content });
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
  }

  async function saveFile() {
    if (!editFile) return;
    setSaving(true);
    try {
      const res = await authFetch(`/client/hosting/${service.id}/files/content`, {
        method: "PUT", body: JSON.stringify({ path: editFile.path, content: editFile.content }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      toast({ title: "File saved" });
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function deleteItem(item: FsItem) {
    if (!confirm(`Delete "${item.file}"? This cannot be undone.`)) return;
    try {
      const res = await authFetch(`/client/hosting/${service.id}/files`, {
        method: "DELETE", body: JSON.stringify({ path: item.fullpath }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Delete failed");
      toast({ title: `"${item.file}" deleted` });
      loadDir(currentPath);
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;
    setMkdiring(true);
    try {
      const res = await authFetch(`/client/hosting/${service.id}/files/mkdir`, {
        method: "POST", body: JSON.stringify({ path: currentPath, name: newFolderName.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast({ title: `Folder "${newFolderName}" created` });
      setNewFolderName(""); setShowMkdir(false); loadDir(currentPath);
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setMkdiring(false); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("dir", currentPath);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/client/hosting/${service.id}/files/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Upload failed");
      toast({ title: "File uploaded", description: file.name });
      loadDir(currentPath);
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setUploading(false); e.target.value = ""; }
  }

  const breadcrumbs = currentPath.split("/").filter(Boolean);

  if (!isWHM) return <NotAvailable reason="File Manager is available on WHM/cPanel servers. This account uses a different server type." />;

  if (isSyncing) return (
    <div className="space-y-5">
      <SectionHeader title="File Manager" description="Browse and manage your hosting files" />
      <Card className="flex items-center gap-4 p-5">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Loader2 size={20} className="text-blue-500 animate-spin" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Data Synching...</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            The server is taking longer than usual to respond. Your files are safe — please retry in a moment.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { isInitialLoad.current = true; loadDir("public_html"); }}
          className="gap-1.5 shrink-0">
          <Loader2 size={13} />
          Retry
        </Button>
      </Card>
    </div>
  );

  if (mgmtError) return (
    <div className="space-y-5">
      <SectionHeader title="File Manager" description="Browse and manage your hosting files" />
      <MgmtUnavailable message={mgmtError} onRetry={() => { isInitialLoad.current = true; loadDir("public_html"); }} />
    </div>
  );

  if (editFile) {
    return (
      <div className="space-y-3">
        <SectionHeader title="File Manager" description={editFile.path}
          action={<div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditFile(null)} className="gap-1.5"><ArrowLeft size={13} /> Back</Button>
            <Button size="sm" onClick={saveFile} disabled={saving} className="gap-1.5 bg-primary hover:bg-primary/90">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
            </Button>
          </div>} />
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 flex items-center justify-between border-b border-border">
            <span className="text-xs font-mono text-muted-foreground">{editFile.path.split("/").pop()}</span>
            <span className="text-xs text-muted-foreground">{editFile.content.length.toLocaleString()} chars</span>
          </div>
          <textarea
            className="w-full font-mono text-sm p-4 bg-[#1e1e2e] text-[#cdd6f4] resize-none outline-none"
            style={{ minHeight: 480 }}
            value={editFile.content}
            onChange={e => setEditFile(f => f ? { ...f, content: e.target.value } : null)}
            spellCheck={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="File Manager" description={`/${currentPath}`}
        action={<div className="flex gap-2">
          <input ref={r => { uploadRef.current = r; }} type="file" className="hidden" onChange={handleUpload} />
          <Button size="sm" variant="outline" onClick={() => setShowMkdir(s => !s)} className="gap-1.5"><FolderPlus size={13} /> New Folder</Button>
          <Button size="sm" variant="outline" onClick={() => uploadRef.current?.click()} disabled={uploading} className="gap-1.5">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload
          </Button>
        </div>} />

      {/* Disk Usage Preview Card */}
      <DiskUsageCard service={service} />

      {showMkdir && (
        <Card className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">New Folder Name</label>
            <Input placeholder="my-folder" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setShowMkdir(false); }} autoFocus />
          </div>
          <Button onClick={createFolder} disabled={mkdiring || !newFolderName.trim()} className="gap-1.5 bg-primary hover:bg-primary/90">
            {mkdiring ? <Loader2 size={13} className="animate-spin" /> : <FolderPlus size={13} />} Create
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowMkdir(false)}><X size={15} /></Button>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {/* Breadcrumb */}
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-1 text-sm overflow-x-auto">
          <button onClick={() => navigateTo("public_html")} className="text-primary hover:underline flex items-center gap-1 shrink-0"><Home size={13} /> Home</button>
          {breadcrumbs.slice(1).map((seg, i) => {
            const path = breadcrumbs.slice(0, i + 2).join("/");
            return (
              <span key={path} className="flex items-center gap-1 shrink-0">
                <ChevronRight size={12} className="text-muted-foreground" />
                <button onClick={() => navigateTo(path)} className="text-primary hover:underline">{seg}</button>
              </span>
            );
          })}
        </div>

        {loadingDir ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Up dir row */}
            {breadcrumbs.length > 1 && (
              <button onClick={navigateUp} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 text-sm text-muted-foreground border-b border-border/50 transition-colors">
                <ArrowUp size={14} className="shrink-0" /> ../ (parent directory)
              </button>
            )}
            {items.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">This directory is empty</div>
            )}
            <div className="divide-y divide-border/60">
              {items.map(item => (
                <div key={item.file} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group">
                  <button
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    onClick={() => item.type === "dir" ? navigateTo(item.fullpath) : openFile(item)}
                  >
                    {fileIcon(item)}
                    <span className={`text-sm truncate ${item.type === "dir" ? "font-medium text-foreground" : "text-foreground"}`}>{item.file}</span>
                  </button>
                  <span className="text-xs text-muted-foreground shrink-0 ml-auto pr-2 hidden sm:block">
                    {item.type === "file" ? item.humansize : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 hidden md:block w-36">
                    {item.mtime ? format(new Date(item.mtime * 1000), "MMM d, yyyy HH:mm") : "—"}
                  </span>
                  <button
                    onClick={() => deleteItem(item)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-destructive transition-all"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: SSL
// ═══════════════════════════════════════════════════════════════════════════════
function SectionSSL({ service, refetch }: { service: Service; refetch: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [forceHttps, setForceHttps] = useState(false);

  async function handleInstallSSL() {
    setLoading(true);
    try {
      const res = await authFetch(`/client/hosting/${service.id}/reinstall-ssl`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast({ title: isActive ? "SSL reinstalled" : "SSL activated", description: "Your site is now protected with HTTPS." });
      setTimeout(() => refetch(), 4000);
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  const isActive = ["active", "installed"].includes(service.sslStatus);
  const isInstalling = service.sslStatus === "installing";

  return (
    <div className="space-y-5">
      <SectionHeader title="SSL / HTTPS" description="SSL encrypts the connection between your visitors and your server — it's what puts the padlock in the browser and the 'S' in HTTPS." />

      {/* Main SSL toggle card */}
      <Card>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isActive ? "bg-emerald-50" : "bg-muted"}`}>
            {isActive ? <ShieldCheck size={22} className="text-emerald-600" /> : <ShieldX size={22} className="text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-foreground">{isActive ? "SSL Active" : isInstalling ? "Installing…" : "SSL Not Installed"}</p>
              {isActive && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Protected
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isActive ? `${service.domain} is secured with Let's Encrypt` : "Enable free SSL to secure your site with HTTPS"}
            </p>
          </div>
          {/* Toggle switch */}
          <button
            onClick={!loading && !isInstalling ? handleInstallSSL : undefined}
            disabled={loading || isInstalling}
            aria-label="Toggle SSL"
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${isActive ? "bg-emerald-500" : "bg-gray-200"} ${loading || isInstalling ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${isActive ? "translate-x-6" : "translate-x-1"}`}>
              {(loading || isInstalling) && <Loader2 size={11} className="animate-spin text-gray-400 m-auto mt-1" />}
            </span>
          </button>
        </div>

        {/* Reinstall / Renew row when active */}
        {isActive && (
          <div className="mt-4 pt-4 border-t border-border flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleInstallSSL} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Renew Certificate
            </Button>
            <Button size="sm" variant="ghost" onClick={handleInstallSSL} disabled={loading} className="gap-1.5 text-muted-foreground">
              <ShieldCheck size={13} /> Reinstall
            </Button>
          </div>
        )}
      </Card>

      {/* Force HTTPS toggle */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="font-medium text-foreground text-sm">Force HTTPS Redirect</p>
            <p className="text-xs text-muted-foreground mt-0.5">Automatically redirect all HTTP visitors to HTTPS</p>
          </div>
          <button
            onClick={() => {
              if (!isActive) { toast({ description: "Enable SSL first to use Force HTTPS.", variant: "destructive" }); return; }
              setForceHttps(v => !v);
              toast({ title: forceHttps ? "Force HTTPS disabled" : "Force HTTPS enabled" });
            }}
            aria-label="Force HTTPS"
            className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-200 ${forceHttps && isActive ? "bg-primary" : "bg-gray-200"} ${!isActive ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${forceHttps && isActive ? "translate-x-5" : "translate-x-1"}`} />
          </button>
        </div>
      </Card>

      {/* SSL Features */}
      <Card>
        <h3 className="font-semibold text-foreground mb-3 text-sm">What's included</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            "Free Let's Encrypt certificate",
            "Auto-renewal before expiry",
            "256-bit HTTPS encryption",
            "Browser trust padlock",
            "SEO ranking boost",
            "PCI compliance ready",
          ].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> {f}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: SSH
// ═══════════════════════════════════════════════════════════════════════════════
function SectionSSH({ service }: { service: Service }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<{ enabled: boolean; shell: string; host?: string; port?: number; user?: string; loginCmd?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mgmtError, setMgmtError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const isWHM = !service.twentyIPackageId;

  async function loadStatus() {
    setLoading(true);
    setMgmtError(null);
    try { const d = await apiFetch(`/client/hosting/${service.id}/ssh`); setStatus(d); }
    catch (e: any) { setMgmtError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (isWHM) loadStatus(); else setLoading(false); }, [service.id]);

  async function handleToggle() {
    if (!status) return;
    setToggling(true);
    try {
      await apiFetch(`/client/hosting/${service.id}/ssh/${status.enabled ? "disable" : "enable"}`, { method: "POST" });
      toast({ title: status.enabled ? "SSH disabled" : "SSH enabled" });
      loadStatus();
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setToggling(false); }
  }

  if (!isWHM) return <NotAvailable reason="SSH access management is available on WHM/cPanel servers. This account uses a different server type." />;

  if (mgmtError) return (
    <div className="space-y-5">
      <SectionHeader title="SSH Access" description="Secure Shell access to your hosting account" />
      <MgmtUnavailable message={mgmtError} onRetry={loadStatus} />
    </div>
  );

  return (
    <div className="space-y-5">
      <SectionHeader title="SSH Access" description="Secure Shell access to your hosting account" />
      <Card>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${status?.enabled ? "bg-emerald-50" : "bg-muted"}`}>
                <Terminal size={22} className={status?.enabled ? "text-emerald-600" : "text-muted-foreground"} />
              </div>
              <div>
                <p className="font-semibold text-foreground">SSH {status?.enabled ? "Enabled" : "Disabled"}</p>
                <p className="text-sm text-muted-foreground">{status?.shell || "—"}</p>
              </div>
              <Button variant={status?.enabled ? "outline" : "default"} onClick={handleToggle} disabled={toggling} className="ml-auto gap-2">
                {toggling ? <Loader2 size={14} className="animate-spin" /> : status?.enabled ? <Square size={14} /> : <Play size={14} />}
                {status?.enabled ? "Disable SSH" : "Enable SSH"}
              </Button>
            </div>
            {status?.enabled && status.loginCmd && (
              <div className="bg-muted rounded-xl p-4 font-mono text-sm text-foreground break-all">
                {status.loginCmd}
              </div>
            )}
            {status?.enabled && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: "Host", value: status?.host || service.serverIp || "—" },
                  { label: "Port", value: String(status?.port ?? 22) },
                  { label: "Username", value: status?.user || service.username || "—" },
                ].map(row => (
                  <div key={row.label} className="bg-background border border-border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="font-mono text-sm font-medium mt-0.5 text-foreground">{row.value}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: BACKUP
// ═══════════════════════════════════════════════════════════════════════════════
function SectionBackup({ service }: { service: Service }) {
  const { toast } = useToast();
  type Backup = { id: string; domain: string; status: string; type: string; filePath: string | null; sqlPath: string | null; sizeMb: string | null; createdAt: string; completedAt: string | null; errorMessage: string | null };
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function loadBackups() {
    setLoading(true);
    try { const d = await authFetch(`/client/hosting/${service.id}/backups`).then(r => r.json()); setBackups(Array.isArray(d) ? d : []); }
    catch { /* non-fatal */ } finally { setLoading(false); }
  }

  useEffect(() => { loadBackups(); }, [service.id]);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await authFetch(`/client/hosting/${service.id}/backup`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Backup failed");
      toast({ title: "Backup started", description: "Your backup is being created." });
      setTimeout(loadBackups, 4000);
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setCreating(false); }
  }

  async function handleDelete(id: string) {
    try {
      await authFetch(`/client/hosting/${service.id}/backup/${id}`, { method: "DELETE" });
      loadBackups();
    } catch { /* non-fatal */ }
  }

  async function handleRestore(b: Backup) {
    if (!confirm(`Restore "${b.filePath ? b.filePath.split("/").pop() : "this backup"}"? This will overwrite current files. Continue?`)) return;
    setRestoringId(b.id);
    try {
      const res = await authFetch(`/client/hosting/${service.id}/backup/${b.id}/restore`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Restore failed");
      toast({ title: "Restore job started", description: "This may take several minutes to complete." });
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setRestoringId(null); }
  }

  const statusColor: Record<string, string> = {
    completed: "text-emerald-600 bg-emerald-50",
    failed: "text-red-600 bg-red-50",
    pending: "text-yellow-600 bg-yellow-50",
    queued_on_server: "text-blue-600 bg-blue-50",
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Backups" description="Create and restore backups of your hosting account"
        action={<Button size="sm" onClick={handleCreate} disabled={creating} className="gap-1.5 bg-primary hover:bg-primary/90">
          {creating ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} Create Backup
        </Button>} />
      <Card>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
        ) : backups.length === 0 ? (
          <EmptyState icon={ArchiveRestore} title="No backups yet" description="Create your first backup to protect your data" />
        ) : (
          <div className="divide-y divide-border">
            {backups.map(b => (
              <div key={b.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <ArchiveRestore size={14} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{b.filePath ? b.filePath.split("/").pop() : `Backup — ${b.type}`}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(b.createdAt), "MMM d, yyyy HH:mm")} {b.sizeMb ? `· ${b.sizeMb} MB` : ""}</p>
                    {b.errorMessage && <p className="text-xs text-destructive mt-0.5">{b.errorMessage}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[b.status] || "text-muted-foreground bg-muted"}`}>{b.status.replace(/_/g, " ")}</span>
                  {b.status === "completed" && (
                    <Button variant="outline" size="sm" onClick={() => handleRestore(b)} disabled={restoringId === b.id} className="gap-1 text-xs">
                      {restoringId === b.id ? <Loader2 size={12} className="animate-spin" /> : <ArchiveRestore size={12} />} Restore
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(b.id)} className="text-destructive hover:text-destructive"><Trash2 size={14} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: NODE.JS
// ═══════════════════════════════════════════════════════════════════════════════
function SectionNodejs({ service }: { service: Service }) {
  const { toast } = useToast();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ app_name: "", app_root: "public_html/myapp", startup_file: "app.js", app_port: "3000", node_version: "" });
  const [actioning, setActioning] = useState<string | null>(null);
  const isWHM = !service.twentyIPackageId;

  async function load() {
    setLoading(true);
    try { const d = await apiFetch(`/client/hosting/${service.id}/nodejs`); setApps(d.apps || []); }
    catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (isWHM) load(); else setLoading(false); }, [service.id]);

  async function handleCreate() {
    if (!form.app_name.trim() || !form.app_root.trim()) return toast({ description: "App name and root directory are required", variant: "destructive" });
    setCreating(true);
    try {
      await apiFetch(`/client/hosting/${service.id}/nodejs`, { method: "POST", body: JSON.stringify({ ...form, app_port: Number(form.app_port) || 3000 }) });
      toast({ title: "Node.js app created", description: form.app_name });
      setForm({ app_name: "", app_root: "public_html/myapp", startup_file: "app.js", app_port: "3000", node_version: "" });
      setShowCreate(false); load();
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setCreating(false); }
  }

  async function handleAction(appName: string, action: "start" | "stop" | "restart") {
    setActioning(`${appName}-${action}`);
    try {
      await apiFetch(`/client/hosting/${service.id}/nodejs/${encodeURIComponent(appName)}/${action}`, { method: "POST" });
      toast({ title: `App ${action}ed` }); load();
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setActioning(null); }
  }

  async function handleDelete(appName: string) {
    try {
      await apiFetch(`/client/hosting/${service.id}/nodejs/${encodeURIComponent(appName)}`, { method: "DELETE" });
      toast({ title: "App deleted" }); load();
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
  }

  if (!isWHM) return <NotAvailable reason="Node.js app management requires a WHM/cPanel server with Node.js Selector enabled. This account uses a different server type." />;

  return (
    <div className="space-y-5">
      <SectionHeader title="Node.js Apps" description="Manage your Node.js applications"
        action={<Button size="sm" onClick={() => setShowCreate(s => !s)} className="gap-1.5 bg-primary hover:bg-primary/90"><Plus size={13} />Create App</Button>} />

      {showCreate && (
        <Card>
          <h3 className="font-semibold text-foreground mb-4">Create Node.js App</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "App Name", key: "app_name", placeholder: "myapp" },
              { label: "App Root (directory)", key: "app_root", placeholder: "public_html/myapp" },
              { label: "Startup File", key: "startup_file", placeholder: "app.js" },
              { label: "Port", key: "app_port", placeholder: "3000" },
              { label: "Node Version (optional)", key: "node_version", placeholder: "18.x" },
            ].map(f => (
              <div key={f.key} className={f.key === "app_name" ? "col-span-2" : ""}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <Input placeholder={f.placeholder} value={(form as any)[f.key]} onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleCreate} disabled={creating} className="gap-2 bg-primary hover:bg-primary/90">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
        ) : apps.length === 0 ? (
          <EmptyState icon={Code2} title="No Node.js apps" description="Create a Node.js application to run server-side JavaScript" />
        ) : (
          <div className="divide-y divide-border">
            {apps.map(app => (
              <div key={app.app_name} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${app.enabled ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                    <div>
                      <p className="font-medium text-sm text-foreground">{app.app_name}</p>
                      <p className="text-xs text-muted-foreground">{app.app_root} · Port {app.app_port} · {app.startup_file}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {(["start", "stop", "restart"] as const).map(action => {
                      const icons = { start: Play, stop: Square, restart: RotateCcw };
                      const Ic = icons[action];
                      return (
                        <Button key={action} variant="ghost" size="sm" onClick={() => handleAction(app.app_name, action)}
                          disabled={actioning?.startsWith(app.app_name)} className="text-muted-foreground hover:text-foreground w-7 h-7 p-0">
                          {actioning === `${app.app_name}-${action}` ? <Loader2 size={12} className="animate-spin" /> : <Ic size={12} />}
                        </Button>
                      );
                    })}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(app.app_name)} className="text-destructive hover:text-destructive w-7 h-7 p-0">
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: PYTHON
// ═══════════════════════════════════════════════════════════════════════════════
function SectionPython({ service }: { service: Service }) {
  const { toast } = useToast();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ app_name: "", app_root: "public_html/myapp", app_uri: "/", python_version: "3.9" });
  const [actioning, setActioning] = useState<string | null>(null);
  const isWHM = !service.twentyIPackageId;

  async function load() {
    setLoading(true);
    try { const d = await apiFetch(`/client/hosting/${service.id}/python`); setApps(d.apps || []); }
    catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (isWHM) load(); else setLoading(false); }, [service.id]);

  async function handleCreate() {
    if (!form.app_name.trim() || !form.app_root.trim()) return toast({ description: "App name and root directory are required", variant: "destructive" });
    setCreating(true);
    try {
      await apiFetch(`/client/hosting/${service.id}/python`, { method: "POST", body: JSON.stringify(form) });
      toast({ title: "Python app created", description: form.app_name });
      setForm({ app_name: "", app_root: "public_html/myapp", app_uri: "/", python_version: "3.9" });
      setShowCreate(false); load();
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setCreating(false); }
  }

  async function handleAction(appName: string, action: "restart" | "stop") {
    setActioning(`${appName}-${action}`);
    try {
      await apiFetch(`/client/hosting/${service.id}/python/${encodeURIComponent(appName)}/${action}`, { method: "POST" });
      toast({ title: `App ${action}ed` }); load();
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setActioning(null); }
  }

  async function handleDelete(appName: string) {
    try {
      await apiFetch(`/client/hosting/${service.id}/python/${encodeURIComponent(appName)}`, { method: "DELETE" });
      toast({ title: "App deleted" }); load();
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
  }

  if (!isWHM) return <NotAvailable reason="Python app management requires a WHM/cPanel server with Python Selector enabled. This account uses a different server type." />;

  return (
    <div className="space-y-5">
      <SectionHeader title="Python Apps" description="Manage your Python web applications"
        action={<Button size="sm" onClick={() => setShowCreate(s => !s)} className="gap-1.5 bg-primary hover:bg-primary/90"><Plus size={13} />Create App</Button>} />

      {showCreate && (
        <Card>
          <h3 className="font-semibold text-foreground mb-4">Create Python App</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "App Name", key: "app_name", placeholder: "myapp", span: true },
              { label: "App Root", key: "app_root", placeholder: "public_html/myapp" },
              { label: "App URI", key: "app_uri", placeholder: "/" },
              { label: "Python Version", key: "python_version", placeholder: "3.9" },
            ].map(f => (
              <div key={f.key} className={f.span ? "col-span-2" : ""}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
                <Input placeholder={f.placeholder} value={(form as any)[f.key]} onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleCreate} disabled={creating} className="gap-2 bg-primary hover:bg-primary/90">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
        ) : apps.length === 0 ? (
          <EmptyState icon={Cpu} title="No Python apps" description="Create a Python app with Django, Flask, or any WSGI framework" />
        ) : (
          <div className="divide-y divide-border">
            {apps.map(app => {
              const venvPath = app.venv_dir ?? app.venv_path ?? (app.app_root ? `${app.app_root}/venv` : null);
              return (
                <div key={app.app_name} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${app.enabled ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                      <div>
                        <p className="font-medium text-sm text-foreground">{app.app_name}</p>
                        <p className="text-xs text-muted-foreground">{app.app_root} · Python {app.python_version ?? "3.x"} · URI: {app.app_uri}</p>
                        {venvPath && <p className="text-xs text-muted-foreground mt-0.5 font-mono">venv: {venvPath}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {(["restart", "stop"] as const).map(action => {
                        const icons = { restart: RotateCcw, stop: Square };
                        const Ic = icons[action];
                        return (
                          <Button key={action} variant="ghost" size="sm" onClick={() => handleAction(app.app_name, action)}
                            disabled={!!actioning} className="text-muted-foreground hover:text-foreground w-7 h-7 p-0">
                            {actioning === `${app.app_name}-${action}` ? <Loader2 size={12} className="animate-spin" /> : <Ic size={12} />}
                          </Button>
                        );
                      })}
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(app.app_name)} className="text-destructive hover:text-destructive w-7 h-7 p-0">
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                  {/* venv activation command */}
                  {venvPath && (
                    <div className="mt-2 ml-5 bg-muted/60 rounded-lg px-3 py-2 font-mono text-xs text-muted-foreground">
                      source {venvPath}/bin/activate
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED: Disk Usage Card (used in File Manager and potentially Overview)
// ═══════════════════════════════════════════════════════════════════════════════
function DiskUsageCard({ service }: { service: Service }) {
  const [usage, setUsage] = useState<any>(null);
  useEffect(() => {
    authFetch(`/client/hosting/${service.id}/usage`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setUsage(d))
      .catch(() => null);
  }, [service.id]);

  const diskUsed = usage?.diskUsed ?? service.diskUsed ?? "0 MB";
  const diskPct  = Math.min(usage?.diskPct ?? 0, 100);
  const bwUsed   = usage?.bwUsed ?? service.bandwidthUsed ?? "0 MB";
  const bwPct    = Math.min(usage?.bwPct ?? 0, 100);
  const diskUnlimited = usage?.diskUnlimited ?? false;
  const bwUnlimited   = usage?.bwUnlimited ?? false;

  function barColor(pct: number) {
    if (pct > 85) return "bg-red-500";
    if (pct > 65) return "bg-amber-500";
    return "bg-emerald-500";
  }

  return (
    <Card className="flex flex-col sm:flex-row gap-5">
      {[
        { label: "Disk Usage", used: diskUsed, pct: diskPct, unlimited: diskUnlimited, icon: HardDrive, color: "text-violet-600 bg-violet-50" },
        { label: "Bandwidth",  used: bwUsed,   pct: bwPct,   unlimited: bwUnlimited,   icon: Wifi,      color: "text-blue-600 bg-blue-50" },
      ].map(m => (
        <div key={m.label} className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${m.color}`}>
                <m.icon size={13} />
              </div>
              <span className="text-sm font-medium text-foreground">{m.label}</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {m.unlimited ? "Unlimited" : `${m.used} used · ${m.pct}%`}
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            {m.unlimited
              ? <div className="h-full w-full bg-emerald-300 opacity-40 rounded-full" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.4) 4px, rgba(255,255,255,0.4) 8px)" }} />
              : <div className={`h-full rounded-full transition-all duration-700 ${barColor(m.pct)}`} style={{ width: `${m.pct}%` }} />
            }
          </div>
          {!m.unlimited && m.pct > 85 && (
            <p className="text-xs text-red-600 mt-1 font-medium">Storage nearly full — consider upgrading your plan.</p>
          )}
        </div>
      ))}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: SOFTWARE (One-click Installers)
// ═══════════════════════════════════════════════════════════════════════════════
function SectionSoftware({ service, navigateTo }: { service: Service; navigateTo: (s: NavSection) => void }) {
  const isWHM = !service.twentyIPackageId;
  const wpInstalled = service.wpInstalled;

  const apps = [
    {
      id: "wordpress",
      name: "WordPress",
      Icon: Boxes,
      description: "The world's most popular CMS — blogs, portfolios, online stores, and more.",
      status: wpInstalled ? "Installed" : "Not installed",
      badge: wpInstalled ? { label: "Active", cls: "bg-emerald-100 text-emerald-700" } : null,
      statusDot: wpInstalled ? "bg-emerald-500" : "bg-muted-foreground",
      cta: wpInstalled ? "Manage WordPress" : "Install WordPress",
      ctaCls: wpInstalled ? "variant-outline" : "default",
      onClick: () => navigateTo("wordpress"),
      available: true,
    },
    {
      id: "ghost",
      name: "Ghost",
      Icon: Ghost,
      description: "Modern headless CMS for creators — ideal for blogs and paid newsletters.",
      status: "External Setup",
      badge: { label: "Guide Available", cls: "bg-blue-100 text-blue-700" },
      statusDot: "bg-blue-400",
      cta: "View Setup Guide",
      ctaCls: "variant-outline",
      onClick: () => window.open("https://ghost.org/docs/install/ubuntu/", "_blank"),
      available: true,
    },
    {
      id: "nodejs",
      name: "Custom Node.js App",
      Icon: Code2,
      description: "Deploy your own Node.js application — APIs, bots, real-time apps.",
      status: isWHM ? "Available" : "Requires cPanel",
      badge: isWHM ? { label: "Ready", cls: "bg-green-100 text-green-700" } : null,
      statusDot: isWHM ? "bg-green-500" : "bg-muted-foreground",
      cta: "Manage Apps",
      ctaCls: "variant-outline",
      onClick: () => navigateTo("nodejs"),
      available: isWHM,
    },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader title="Software" description="Install popular applications on your hosting account with one click." />
      <div className="space-y-3">
        {apps.map(app => (
          <Card key={app.id}>
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <app.Icon size={20} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="font-semibold text-foreground text-sm">{app.name}</p>
                  {app.badge && (
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${app.badge.cls}`}>
                      {app.badge.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{app.description}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${app.statusDot}`} />
                  <span className="text-xs text-muted-foreground">{app.status}</span>
                </div>
              </div>
              <Button
                size="sm"
                variant={app.id === "wordpress" && !wpInstalled ? "default" : "outline"}
                onClick={app.onClick}
                className={`shrink-0 gap-1.5 ${app.id === "wordpress" && !wpInstalled ? "bg-primary hover:bg-primary/90" : ""}`}
                disabled={!app.available}
              >
                {app.cta}
                {(app.id === "ghost") && <ExternalLink size={12} />}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Info note */}
      <Card className="flex items-start gap-3 bg-muted/40">
        <BookOpen size={16} className="text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Need something else? Your hosting plan includes Softaculous — a library of 400+ one-click installers. Access it via the cPanel link in your service overview.
        </p>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: ENVIRONMENT (PHP / Runtime Version Selector)
// ═══════════════════════════════════════════════════════════════════════════════
function SectionEnvironment({ service }: { service: Service }) {
  const { toast } = useToast();
  const PHP_VERSIONS = ["7.4", "8.0", "8.1", "8.2", "8.3"];
  const [currentPhp, setCurrentPhp] = useState<string | null>(null);
  const [loadingPhp, setLoadingPhp] = useState(true);
  const [settingPhp, setSettingPhp] = useState<string | null>(null);

  useEffect(() => {
    authFetch(`/client/hosting/${service.id}/php-version`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.version) setCurrentPhp(d.version); })
      .catch(() => null)
      .finally(() => setLoadingPhp(false));
  }, [service.id]);

  async function handleSetPhp(version: string) {
    if (version === currentPhp) return;
    setSettingPhp(version);
    try {
      const res = await authFetch(`/client/hosting/${service.id}/php-version`, {
        method: "POST",
        body: JSON.stringify({ version }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to change PHP version");
      setCurrentPhp(version);
      toast({ title: "PHP version updated", description: `Your site is now running PHP ${version}.` });
    } catch (e: any) {
      toast({ description: e.message, variant: "destructive" });
    } finally {
      setSettingPhp(null);
    }
  }

  const isWHM = !service.twentyIPackageId;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Environment"
        description="Switch PHP and runtime versions for your hosting account. Changes take effect immediately."
      />

      {/* PHP Version Selector */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground text-sm">PHP Version</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loadingPhp ? "Detecting current version…" : currentPhp ? `Currently running PHP ${currentPhp}` : "Version not detected — select one below to apply"}
            </p>
          </div>
          {currentPhp && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
              <Sparkles size={11} /> Optimized
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {PHP_VERSIONS.map(v => {
            const isCurrent = v === currentPhp;
            const isSetting = settingPhp === v;
            return (
              <button
                key={v}
                onClick={() => handleSetPhp(v)}
                disabled={!!settingPhp || loadingPhp}
                className={`relative flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 transition-all text-sm font-semibold ${
                  isCurrent
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                } ${!!settingPhp && !isSetting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {isSetting ? (
                  <Loader2 size={16} className="animate-spin text-primary" />
                ) : (
                  <>
                    <span className="text-xs font-bold">{v}</span>
                    {isCurrent && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <CheckCircle2 size={10} className="text-white" />
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          <strong>Tip:</strong> PHP 8.2 and 8.3 offer the best performance and security. We recommend upgrading if your plugins support it.
        </p>
      </Card>

      {/* Runtime Status */}
      <Card>
        <h3 className="font-semibold text-foreground text-sm mb-3">Runtime Status</h3>
        <div className="space-y-3">
          {[
            { label: "PHP",     value: currentPhp ? `PHP ${currentPhp}` : "Unknown",   status: currentPhp ? "active" : "unknown", badge: currentPhp ? "Optimized" : null, badgeCls: "bg-indigo-100 text-indigo-700" },
            { label: "Node.js", value: isWHM ? "Managed via Selector" : "Not available", status: isWHM ? "active" : "inactive",    badge: null, badgeCls: "" },
            { label: "Python",  value: isWHM ? "Managed via Selector" : "Not available", status: isWHM ? "active" : "inactive",    badge: null, badgeCls: "" },
          ].map(rt => (
            <div key={rt.label} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${rt.status === "active" ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">{rt.label}</p>
                  <p className="text-xs text-muted-foreground">{rt.value}</p>
                </div>
              </div>
              {rt.badge && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rt.badgeCls}`}>{rt.badge}</span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: DOMAINS / DNS (existing DNS management)
// ═══════════════════════════════════════════════════════════════════════════════
function SectionDomains({ service }: { service: Service }) {
  const { toast } = useToast();
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loadingDns, setLoadingDns] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newRecord, setNewRecord] = useState({ type: "A", name: "", address: "", ttl: "14400" });

  async function loadDns() {
    setLoadingDns(true);
    try {
      const res = await authFetch(`/dns/${service.id}/zone`);
      if (res.ok) { const d = await res.json(); setRecords(Array.isArray(d) ? d : []); }
    } catch { /* non-fatal */ } finally { setLoadingDns(false); }
  }

  useEffect(() => { loadDns(); }, [service.id]);

  async function handleAdd() {
    setAdding(true);
    try {
      const res = await authFetch(`/dns/${service.id}/record`, {
        method: "POST", body: JSON.stringify({ type: newRecord.type, name: newRecord.name, address: newRecord.address, ttl: Number(newRecord.ttl) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast({ title: "DNS record added" }); setNewRecord({ type: "A", name: "", address: "", ttl: "14400" }); loadDns();
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setAdding(false); }
  }

  async function handleDelete(line: number) {
    try {
      const res = await authFetch(`/dns/${service.id}/record/${line}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed"); toast({ title: "Record deleted" }); loadDns();
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Domains & DNS" description="Manage DNS records for your domain" />
      <Card>
        <h3 className="font-semibold text-foreground mb-4">Add DNS Record</h3>
        <div className="grid grid-cols-4 gap-2">
          <select value={newRecord.type} onChange={e => setNewRecord(r => ({ ...r, type: e.target.value }))}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background">
            {["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"].map(t => <option key={t}>{t}</option>)}
          </select>
          <Input placeholder="Name (@, www...)" value={newRecord.name} onChange={e => setNewRecord(r => ({ ...r, name: e.target.value }))} />
          <Input placeholder="Value (IP, hostname...)" value={newRecord.address} onChange={e => setNewRecord(r => ({ ...r, address: e.target.value }))} />
          <Button onClick={handleAdd} disabled={adding} className="bg-primary hover:bg-primary/90">
            {adding ? <Loader2 size={14} className="animate-spin" /> : "Add"}
          </Button>
        </div>
      </Card>
      <Card>
        {loadingDns ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
        ) : records.length === 0 ? (
          <EmptyState icon={Globe} title="No DNS records" description="Add DNS records above to manage your domain" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="pb-2 font-medium">Type</th><th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Value</th><th className="pb-2 font-medium">TTL</th><th className="pb-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {records.map(r => (
                  <tr key={r.line}>
                    <td className="py-2"><Badge variant="outline" className="font-mono text-xs">{r.type}</Badge></td>
                    <td className="py-2 font-mono text-xs text-foreground max-w-[150px] truncate">{r.name}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground max-w-[200px] truncate">{r.address}</td>
                    <td className="py-2 text-xs text-muted-foreground">{r.ttl}</td>
                    <td className="py-2"><Button variant="ghost" size="sm" onClick={() => handleDelete(r.line)} className="text-destructive hover:text-destructive w-7 h-7 p-0"><Trash2 size={12} /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: AI SUPPORT SPECIALIST
// ═══════════════════════════════════════════════════════════════════════════════

type AiMessage = { role: "user" | "assistant" | "system"; content: string; ts?: number };

const ACTION_MAP: Record<string, { label: string; color: string; icon: React.ElementType; action: (svc: Service) => void }> = {
  fix_permissions: {
    label: "Fix Permissions",
    color: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/30",
    icon: ShieldCheck,
    action: (svc) => {
      const token = localStorage.getItem("token");
      fetch(`/api/client/hosting/${svc.id}/fix-permissions`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      }).then(() => { /* toast handled by parent */ }).catch(() => {});
    },
  },
  clear_cache: {
    label: "Clear Cache",
    color: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/30",
    icon: Zap,
    action: (svc) => {
      const token = localStorage.getItem("token");
      fetch(`/api/client/hosting/${svc.id}/cache`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ edge: true, object: true }),
      }).catch(() => {});
    },
  },
  open_file_manager: {
    label: "Open File Manager",
    color: "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/30",
    icon: FolderOpen,
    action: () => {},
  },
  open_wordpress: {
    label: "WordPress Admin",
    color: "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-500/30",
    icon: Boxes,
    action: (svc) => { window.open(`https://${svc.domain}/wp-admin`, "_blank"); },
  },
};

function parseActions(text: string): { cleanText: string; actions: string[] } {
  const actions: string[] = [];
  const cleanText = text.replace(/\[ACTION:\s*(\w+)\]/g, (_: string, key: string) => {
    if (key !== "create_ticket") actions.push(key);
    return "";
  }).replace(/\[ACTION:\s*create_ticket\]/g, "").trim();
  return { cleanText, actions };
}

function AiMessageBubble({
  msg, service, onCreateTicket, conversation,
}: {
  msg: AiMessage;
  service: Service | null;
  onCreateTicket: (convo: AiMessage[]) => void;
  conversation: AiMessage[];
}) {
  const isUser = msg.role === "user";
  const { cleanText, actions } = isUser ? { cleanText: msg.content, actions: [] } : parseActions(msg.content);
  const wantsTicket = !isUser && msg.content.includes("[ACTION: create_ticket]");

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${
        isUser ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
      }`}>
        {isUser ? <span>U</span> : <Bot size={14} />}
      </div>
      <div className={`max-w-[82%] space-y-2 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted/70 text-foreground rounded-tl-sm border border-border/60"
        }`}>
          {cleanText}
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {actions.map(key => {
              const def = ACTION_MAP[key];
              if (!def) return null;
              const Icon = def.icon;
              return (
                <button key={key}
                  onClick={() => service && def.action(service)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${def.color}`}>
                  <Icon size={11} />
                  {def.label}
                </button>
              );
            })}
          </div>
        )}
        {wantsTicket && (
          <button
            onClick={() => onCreateTicket(conversation)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/30 transition-colors">
            <TicketCheck size={12} />
            Auto-Create Support Ticket
          </button>
        )}
      </div>
    </div>
  );
}

function SectionAiSupport({ service }: { service: Service | null }) {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const WELCOME: AiMessage = {
    role: "assistant",
    content: service
      ? `Hi! I'm Noe, your 24/7 AI Support Specialist. I can see your hosting account for *${service.domain}* (${service.planName ?? "Starter"}, status: ${service.status}). Describe any issue and I'll read your server logs and suggest an instant fix — or escalate it automatically if needed. [ACTION: create_ticket]`
      : "Hi! I'm Noe, your AI Support Specialist. Tell me about your issue and I'll help you resolve it right away.",
    ts: Date.now(),
  };

  const QUICK_PROMPTS = [
    "My site is showing a 500 error",
    "WordPress is broken after an update",
    "Site is loading very slowly",
    "SSL certificate isn't working",
    "I can't access my email",
    "Database connection error",
  ];

  const [messages, setMessages]     = useState<AiMessage[]>([WELCOME]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [ticketing, setTicketing]   = useState(false);
  const [ticketResult, setTicketResult] = useState<{ ticketNumber: string } | null>(null);

  const token = () => localStorage.getItem("token") ?? "";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Load conversation history on mount
  useEffect(() => {
    if (!service?.id) return;
    fetch(`/api/ai/specialist/history/${service.id}`, {
      headers: { Authorization: `Bearer ${token()}` },
    }).then(r => r.json()).then(data => {
      if (data.messages?.length > 0) {
        const hist: AiMessage[] = data.messages.map((m: any) => ({
          role: m.role as AiMessage["role"],
          content: m.content,
          ts: new Date(m.created_at).getTime(),
        }));
        setMessages([WELCOME, ...hist]);
      }
    }).catch(() => {});
  }, [service?.id]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const userMsg: AiMessage = { role: "user", content, ts: Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/specialist/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          messages: updated.filter(m => m.role !== "system").slice(-14).map(m => ({ role: m.role, content: m.content })),
          serviceId: service?.id,
        }),
      });
      const data = await res.json();
      const reply = data.reply ?? "Sorry, I couldn't process that. [ACTION: create_ticket]";
      setMessages(prev => [...prev, { role: "assistant", content: reply, ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm having connection trouble. [ACTION: create_ticket] to reach our support team directly.",
        ts: Date.now(),
      }]);
    } finally { setLoading(false); }
  };

  const createTicket = async (convo: AiMessage[]) => {
    setTicketing(true);
    try {
      const subject = convo.find(m => m.role === "user")?.content?.slice(0, 80) ?? "AI Support Auto-Escalation";
      const res = await fetch("/api/ai/specialist/auto-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ conversation: convo, serviceId: service?.id, subject }),
      });
      const data = await res.json();
      if (data.success) {
        setTicketResult({ ticketNumber: data.ticketNumber });
        toast({ title: "Ticket Created!", description: `Ticket ${data.ticketNumber} sent to the Noehost support team with full technical logs.` });
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `I've created support ticket **${data.ticketNumber}** with all your error logs attached. The Noehost team will respond within 24 hours. You'll also find it under Support → My Tickets.`,
          ts: Date.now(),
        }]);
      }
    } catch {
      toast({ title: "Error creating ticket", variant: "destructive" });
    } finally { setTicketing(false); }
  };

  const resetChat = () => {
    setMessages([WELCOME]);
    setTicketResult(null);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full max-h-[680px] bg-background rounded-2xl border border-border overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-indigo-500/5 via-violet-500/5 to-transparent">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
          <Bot size={18} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Noe · AI Support Specialist</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
            Active 24/7 · Reads your server logs in real time
          </p>
        </div>
        <button onClick={resetChat} className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/60" title="New conversation">
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Message feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
        {messages.map((msg, i) => (
          <AiMessageBubble key={i} msg={msg} service={service} onCreateTicket={createTicket} conversation={messages} />
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-muted/70 border border-border/60">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        {ticketResult && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-xs">
            <CheckCircle2 size={14} />
            Ticket {ticketResult.ticketNumber} created — our team will reply within 24 hours.
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts (only show initially) */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">Common issues</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map(q => (
              <button key={q} onClick={() => sendMessage(q)}
                className="px-2.5 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/60 transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-background/80 backdrop-blur-sm">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={loading ? "Noe is thinking…" : "Describe your issue or error…"}
            disabled={loading || ticketing}
            className="flex-1 bg-muted/50 border border-border rounded-xl px-3.5 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background transition-all disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading || ticketing}
            className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-all shrink-0">
            {loading || ticketing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Noe reads your error logs and suggests targeted fixes. Complex issues are auto-escalated to the team.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: STAGING & CLONING
// ═══════════════════════════════════════════════════════════════════════════════

/** Animated step-by-step progress tracker */
function StepTracker({ steps }: { steps: { key: string; label: string; status: "done" | "active" | "pending" | "error" }[] }) {
  return (
    <div className="space-y-2.5">
      {steps.map((step, i) => {
        const isDone    = step.status === "done";
        const isActive  = step.status === "active";
        const isError   = step.status === "error";
        return (
          <div key={step.key} className="flex items-center gap-3">
            {/* connector line */}
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                isDone  ? "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.35)]" :
                isActive? "bg-primary text-white shadow-[0_0_12px_rgba(99,102,241,0.4)] animate-pulse" :
                isError ? "bg-red-500 text-white" :
                          "bg-muted text-muted-foreground"
              }`}>
                {isDone  ? <CheckCircle2 size={14} /> :
                 isActive? <Loader2 size={13} className="animate-spin" /> :
                 isError ? <X size={13} /> :
                           <span>{i + 1}</span>}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-0.5 h-4 mt-0.5 transition-colors duration-700 ${isDone ? "bg-emerald-400" : "bg-border"}`} />
              )}
            </div>
            <span className={`text-sm transition-colors ${
              isDone ? "text-foreground font-medium" : isActive ? "text-primary font-semibold" : "text-muted-foreground"
            }`}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Full-width success flash animation */
function SuccessBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 5000); return () => clearTimeout(t); }, []);
  return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-emerald-50 border border-emerald-200 animate-in slide-in-from-top-2 duration-300">
      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-[0_0_14px_rgba(16,185,129,0.4)]">
        <CheckCircle2 size={16} className="text-white" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-emerald-800">{message}</p>
      </div>
      <button onClick={onDismiss} className="text-emerald-600 hover:text-emerald-800"><X size={14} /></button>
    </div>
  );
}

/** Website builder quick-launch cards */
const BUILDERS = [
  { name: "Elementor",   desc: "Drag-and-drop WordPress editor",    color: "#E22D2D", icon: "🎨", url: "https://elementor.com" },
  { name: "Divi",        desc: "Visual builder with 800+ templates", color: "#7D4CDB", icon: "✏️", url: "https://www.elegantthemes.com/gallery/divi" },
  { name: "Framer",      desc: "Interactive no-code site builder",  color: "#0D0D0D", icon: "⚡", url: "https://www.framer.com" },
  { name: "Webflow",     desc: "Professional CMS + designer tool",  color: "#4353FF", icon: "🌐", url: "https://webflow.com" },
];

function SectionStaging({ service }: { service: Service }) {
  const { toast } = useToast();

  const [stagingData, setStagingData] = useState<any>(null);
  const [syncLogs,    setSyncLogs]    = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Progress / animation state
  const [progressSteps, setProgressSteps] = useState<any[] | null>(null);
  const [actionLoading, setActionLoading]  = useState<string | null>(null);
  const [success,       setSuccess]        = useState<string | null>(null);
  const [confirmPush,   setConfirmPush]    = useState(false);

  const load = async () => {
    try {
      const r = await authFetch(`/client/hosting/${service.id}/staging`);
      if (r.ok) { const d = await r.json(); setStagingData(d.staging); setSyncLogs(d.logs ?? []); }
    } catch {} finally { setLoadingData(false); }
  };

  useEffect(() => { load(); }, [service.id]);

  const activeStaging = stagingData && stagingData.status !== "deleted";

  // Animate steps one-by-one for visual flair
  async function animateSteps(finalSteps: any[]) {
    const pending = finalSteps.map(s => ({ ...s, status: "pending" }));
    setProgressSteps(pending);
    for (let i = 0; i < finalSteps.length; i++) {
      await new Promise(r => setTimeout(r, 550));
      setProgressSteps(prev => prev!.map((s, j) => j === i ? { ...s, status: "active" } : s));
      await new Promise(r => setTimeout(r, 700));
      setProgressSteps(prev => prev!.map((s, j) => j === i ? { ...s, status: finalSteps[i].status } : s));
    }
  }

  async function handleCreate() {
    setActionLoading("create");
    setProgressSteps([
      { key: "init",      label: "Initialising clone",         status: "pending" },
      { key: "files",     label: "Copying files & assets",     status: "pending" },
      { key: "db",        label: "Cloning database",           status: "pending" },
      { key: "subdomain", label: "Setting up staging domain",  status: "pending" },
      { key: "ssl",       label: "Issuing SSL certificate",    status: "pending" },
    ]);
    try {
      const r = await authFetch(`/client/hosting/${service.id}/staging/create`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Create failed");
      await animateSteps(d.steps);
      await load();
      setSuccess(`Staging site is ready at ${d.stagingUrl}`);
    } catch (e: any) {
      toast({ title: "Staging Error", description: e.message, variant: "destructive" });
      setProgressSteps(null);
    } finally { setActionLoading(null); }
  }

  async function handlePushToLive() {
    setConfirmPush(false);
    setActionLoading("push");
    setProgressSteps([
      { key: "backup",  label: "Backing up live site",        status: "pending" },
      { key: "files",   label: "Syncing files to production", status: "pending" },
      { key: "db",      label: "Syncing database",            status: "pending" },
      { key: "cache",   label: "Clearing caches",             status: "pending" },
      { key: "verify",  label: "Verifying deployment",        status: "pending" },
    ]);
    try {
      const r = await authFetch(`/client/hosting/${service.id}/staging/push-to-live`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Push failed");
      await animateSteps(d.steps);
      await load();
      setSuccess("Staging successfully pushed to live — your production site is updated!");
    } catch (e: any) {
      toast({ title: "Push Error", description: e.message, variant: "destructive" });
      setProgressSteps(null);
    } finally { setActionLoading(null); }
  }

  async function handleDelete() {
    setActionLoading("delete");
    try {
      const r = await authFetch(`/client/hosting/${service.id}/staging`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Delete failed");
      setStagingData(null); setProgressSteps(null);
      toast({ title: "Staging site deleted" });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Staging & Clone"
        description="Create a full copy of your live site, test changes safely, and push to production in one click"
      />

      {/* Success banner */}
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}

      {/* ── Progress tracker (shown during operations) ── */}
      {progressSteps && (
        <Card>
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Loader2 size={15} className={actionLoading ? "animate-spin text-primary" : "text-emerald-500"} />
            {actionLoading === "create" ? "Creating Staging Site…" :
             actionLoading === "push"   ? "Pushing to Live…"       : "Processing…"}
          </h3>
          <StepTracker steps={progressSteps} />
        </Card>
      )}

      {/* ── No staging yet ── */}
      {!activeStaging && !progressSteps && (
        <Card className="flex flex-col items-center text-center py-10 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Rocket size={26} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-base">No Staging Site Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Create a full 1:1 clone of your live site. Test changes, install plugins, redesign pages — all without affecting your visitors.
            </p>
          </div>
          <Button onClick={handleCreate} disabled={!!actionLoading} className="gap-2 bg-primary hover:bg-primary/90 px-6">
            {actionLoading === "create" ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
            Create Staging Site
          </Button>
          <p className="text-xs text-muted-foreground">Takes 30–60 seconds · All data is saved in PostgreSQL</p>
        </Card>
      )}

      {/* ── Active staging site ── */}
      {activeStaging && !progressSteps && (
        <Card>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                stagingData.status === "ready" ? "bg-emerald-50 text-emerald-600" :
                stagingData.status === "pushed"? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
              }`}>
                <Rocket size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground">Staging Site</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    stagingData.status === "ready"  ? "bg-emerald-50 text-emerald-700" :
                    stagingData.status === "pushed" ? "bg-blue-50 text-blue-700"       :
                    stagingData.status === "creating"? "bg-amber-50 text-amber-700"    : "bg-muted text-muted-foreground"
                  }`}>
                    {stagingData.status === "ready"   ? "Ready" :
                     stagingData.status === "pushed"  ? "Pushed to Live" :
                     stagingData.status === "creating"? "Creating…" : stagingData.status}
                  </span>
                </div>
                <a href={stagingData.staging_url} target="_blank" rel="noopener noreferrer"
                   className="text-sm text-primary hover:underline flex items-center gap-1 mt-1">
                  {stagingData.staging_url} <ExternalLink size={11} />
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  Created {new Date(stagingData.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  {" · "} Provider: <strong>{stagingData.provider}</strong>
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <a href={stagingData.staging_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={13} /> Open
                </a>
              </Button>
              {stagingData.status === "ready" && (
                confirmPush ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Are you sure?</span>
                    <Button size="sm" onClick={handlePushToLive} disabled={!!actionLoading} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                      {actionLoading === "push" ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                      Yes, Push
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmPush(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => setConfirmPush(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                    <UploadCloud size={13} /> Push to Live
                  </Button>
                )
              )}
              <Button variant="ghost" size="sm" onClick={handleDelete} disabled={!!actionLoading}
                className="text-destructive hover:text-destructive gap-1.5">
                {actionLoading === "delete" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Delete
              </Button>
            </div>
          </div>

          {/* Usage tip */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info size={12} className="mt-0.5 shrink-0" />
              <span>Make your changes on the staging site, then click <strong className="text-foreground">Push to Live</strong> to deploy everything to production atomically. All clone metadata and sync logs are saved in PostgreSQL.</span>
            </div>
          </div>
        </Card>
      )}

      {/* ── How it works ── */}
      {!activeStaging && !progressSteps && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { icon: Rocket,      title: "1. Clone",   desc: "We copy every file, database, and config from your live site to an isolated staging URL." },
            { icon: Settings,    title: "2. Test",    desc: "Install plugins, redesign layouts, or update your code — changes only affect staging." },
            { icon: UploadCloud, title: "3. Deploy",  desc: "When you're ready, push staging to live in one click. Your audience sees the update instantly." },
          ] as const).map(item => (
            <div key={item.title} className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <item.icon size={16} className="text-primary" />
              </div>
              <p className="font-semibold text-sm text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Website Builder Quick Launch ── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Palette size={15} className="text-primary" /> Quick Launch — Website Builder
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Connect a no-code builder to your hosting plan and start designing instantly</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BUILDERS.map(b => (
            <a key={b.name} href={b.url} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/40 transition-all group">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                   style={{ background: `${b.color}18` }}>
                {b.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{b.name}</p>
                <p className="text-xs text-muted-foreground truncate">{b.desc}</p>
              </div>
              <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </a>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
          <Info size={11} /> Your hosting plan supports all major WordPress builders. Install via the Software section.
        </p>
      </Card>

      {/* ── Sync Log History ── */}
      {syncLogs.length > 0 && (
        <Card>
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock size={14} className="text-muted-foreground" /> Sync History
          </h3>
          <div className="space-y-2">
            {syncLogs.slice(0, 8).map((log: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-border last:border-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  log.status === "success" ? "bg-emerald-500" :
                  log.status === "error"   ? "bg-red-400"     : "bg-amber-400"
                }`} />
                <span className="capitalize font-medium text-foreground w-28 shrink-0">{log.action.replace(/-/g, " ")}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  log.status === "success" ? "bg-emerald-50 text-emerald-700" :
                  log.status === "error"   ? "bg-red-50 text-red-700"         : "bg-amber-50 text-amber-700"
                }`}>{log.status}</span>
                <span className="text-xs text-muted-foreground flex-1 truncate">{log.note}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(log.logged_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: RESOURCE GUARD (Monitor + Security + Cache)
// ═══════════════════════════════════════════════════════════════════════════════
function AnimatedBar({ pct, color, animated = true }: { pct: number; color: string; animated?: boolean }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { const t = setTimeout(() => setWidth(Math.min(pct, 100)), 120); return () => clearTimeout(t); }, [pct]);
  const safe = Math.min(pct, 100);
  const barColor = safe > 85 ? "#EF4444" : safe > 65 ? "#F59E0B" : color;
  return (
    <div style={{ height: 8, background: "#F3F4F6", borderRadius: 99, overflow: "hidden", width: "100%" }}>
      <div style={{
        height: "100%", width: `${animated ? width : safe}%`,
        background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
        borderRadius: 99, transition: "width 1.2s cubic-bezier(.4,0,.2,1)",
        boxShadow: `0 0 8px ${barColor}44`,
      }} />
    </div>
  );
}

function SparkLine({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return <div style={{ height: 40, background: "#F9FAFB", borderRadius: 8 }} />;
  const max = Math.max(...data, 1);
  const W = 200; const H = 40; const pad = 4;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - (v / max) * (H - pad * 2);
    return `${x},${y}`;
  });
  const area = `M${pts[0]} L${pts.join(" L")} L${W - pad},${H} L${pad},${H} Z`;
  return (
    <svg width={W} height={H} style={{ width: "100%", height: 40 }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace("#", "")})`} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CacheSwitch({ label, description, icon, enabled, onChange, loading }: {
  label: string; description: string; icon: React.ReactNode;
  enabled: boolean; onChange: (v: boolean) => void; loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {icon}
        </div>
        <div>
          <p className="font-medium text-sm text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <button
        onClick={() => !loading && onChange(!enabled)}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? "bg-primary" : "bg-muted-foreground/30"} ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function StatCard({ label, used, limit, pct, color, unit, sparkData, icon }: {
  label: string; used: number | null; limit: number | null;
  pct: number; color: string; unit?: string; sparkData?: number[]; icon: React.ReactNode;
}) {
  const displayUsed  = used  !== null ? `${used.toLocaleString()}${unit ?? ""}` : "—";
  const displayLimit = limit !== null ? `${limit.toLocaleString()}${unit ?? ""}` : "—";
  const safe = Math.min(pct, 100);
  const statusColor = safe > 85 ? "#EF4444" : safe > 65 ? "#F59E0B" : "#10B981";

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div style={{ background: `${color}18`, color }} className="w-8 h-8 rounded-lg flex items-center justify-center">{icon}</div>
          <span className="font-semibold text-sm text-foreground">{label}</span>
        </div>
        <span style={{ background: `${statusColor}15`, color: statusColor }} className="text-xs font-bold px-2 py-0.5 rounded-full">
          {used !== null ? `${Math.round(safe)}%` : "N/A"}
        </span>
      </div>

      <AnimatedBar pct={safe} color={color} />

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Used: <strong className="text-foreground">{displayUsed}</strong></span>
        <span>Limit: <strong className="text-foreground">{displayLimit}</strong></span>
      </div>

      {sparkData && sparkData.length > 1 && (
        <div className="mt-1">
          <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">24h trend</p>
          <SparkLine data={sparkData} color={color} />
        </div>
      )}
    </div>
  );
}

function SectionMonitor({ service }: { service: Service }) {
  const { toast } = useToast();
  const [data, setData]         = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [cacheLoading, setCacheLoading] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh]   = useState<Date | null>(null);

  const load = async () => {
    try {
      const r = await authFetch(`/client/hosting/${service.id}/resource-monitor`);
      if (r.ok) { const d = await r.json(); setData(d); setLastRefresh(new Date()); }
    } catch {}
  };

  const loadHistory = async () => {
    try {
      const r = await authFetch(`/client/hosting/${service.id}/scan-history`);
      if (r.ok) { const d = await r.json(); setScanHistory(d.scans || []); }
    } catch {}
  };

  useEffect(() => { load(); loadHistory(); }, [service.id]);
  // Auto-refresh every 60 s
  useEffect(() => { const id = setInterval(load, 60_000); return () => clearInterval(id); }, [service.id]);

  const stats       = data?.stats       ?? {};
  const history     = (data?.history    ?? []) as any[];
  const cache       = data?.cacheSettings ?? { edge_cache: false, object_cache: false };

  // Build sparkline arrays from history (most recent last)
  const epSpark     = history.slice().reverse().map((h: any) => Number(h.entry_processes || 0));
  const inodeSpark  = history.slice().reverse().map((h: any) => Number(h.inodes_used || 0));
  const cpuSpark    = history.slice().reverse().map((h: any) => Number(h.cpu_pct || 0));
  const ioSpark     = history.slice().reverse().map((h: any) => Number(h.disk_io_read || 0));

  const epPct = stats.entryProcesses && stats.entryProcessLimit
    ? Math.min(100, Math.round((stats.entryProcesses / stats.entryProcessLimit) * 100)) : 0;
  const inodePct = stats.inodesUsed && stats.inodesLimit
    ? Math.min(100, Math.round((stats.inodesUsed / stats.inodesLimit) * 100)) : 0;
  const ioPct = stats.diskIoRead ? Math.min(100, Math.round((stats.diskIoRead / 50) * 100)) : 0; // 50 MB/s reference max

  async function handleFixPermissions() {
    setScanning(true);
    try {
      const r = await authFetch(`/client/hosting/${service.id}/fix-permissions`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Scan failed");
      toast({
        title: d.success ? "Permissions Fixed ✓" : "Scan completed",
        description: d.success
          ? `Reset ${d.dirs} directories (755) & ${d.files} files (644).`
          : d.error || "Completed with warnings.",
      });
      loadHistory();
      load();
    } catch (e: any) {
      toast({ title: "Scan Error", description: e.message, variant: "destructive" });
    } finally { setScanning(false); }
  }

  async function toggleCache(key: "edge_cache" | "object_cache", value: boolean) {
    setCacheLoading(key);
    try {
      const r = await authFetch(`/client/hosting/${service.id}/cache-settings`, {
        method: "POST",
        body: JSON.stringify({ [key]: value }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setData((prev: any) => ({ ...prev, cacheSettings: d.settings }));
      toast({ title: value ? `${key === "edge_cache" ? "Edge" : "Object"} Cache Enabled` : "Cache Disabled" });
    } catch (e: any) {
      toast({ title: "Cache Error", description: e.message, variant: "destructive" });
    } finally { setCacheLoading(null); }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Resource Guard"
        description="Live usage metrics, security hardening, and performance cache controls"
        action={
          <div className="flex items-center gap-2">
            {lastRefresh && <span className="text-xs text-muted-foreground">Updated {lastRefresh.toLocaleTimeString()}</span>}
            <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
              <RefreshCw size={13} /> Refresh
            </Button>
          </div>
        }
      />

      {/* ── Source badge ── */}
      {stats.source && stats.source !== "none" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
            stats.source === "error" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${stats.source === "error" ? "bg-red-500" : "bg-emerald-500"}`} />
            {stats.source === "20i" ? "Live via 20i API" : stats.source === "cpanel" ? "Live via cPanel API" : stats.source === "simulated" ? "Demo data" : "Data unavailable"}
          </span>
          {stats.error && <span className="text-red-500">{stats.error}</span>}
        </div>
      )}

      {/* ── Resource Stats Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Entry Processes"
          used={stats.entryProcesses ?? null}
          limit={stats.entryProcessLimit ?? null}
          pct={epPct}
          color="#7C3AED"
          sparkData={epSpark}
          icon={<Activity size={15} />}
        />
        <StatCard
          label="Inodes"
          used={stats.inodesUsed ?? null}
          limit={stats.inodesLimit ?? null}
          pct={inodePct}
          color="#2563EB"
          sparkData={inodeSpark}
          icon={<HardDrive size={15} />}
        />
        <StatCard
          label="Disk I/O Read"
          used={stats.diskIoRead ?? null}
          limit={50}
          pct={ioPct}
          color="#0891B2"
          unit=" MB/s"
          sparkData={ioSpark}
          icon={<Zap size={15} />}
        />
        <StatCard
          label="CPU Usage"
          used={stats.cpuPct != null ? Math.round(stats.cpuPct) : null}
          limit={100}
          pct={stats.cpuPct ?? 0}
          color="#059669"
          unit="%"
          sparkData={cpuSpark}
          icon={<Cpu size={15} />}
        />
      </div>

      {/* ── Security Guard ── */}
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">Security Guard</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Reset all file/folder permissions to the most secure defaults (755 for directories, 644 for files).</p>
          </div>
          <Button
            onClick={handleFixPermissions}
            disabled={scanning}
            className="gap-2 bg-primary hover:bg-primary/90 shrink-0"
          >
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {scanning ? "Scanning…" : "Scan & Fix Permissions"}
          </Button>
        </div>

        {/* Scan history */}
        {scanHistory.length > 0 ? (
          <div className="mt-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Scan History</p>
            <div className="space-y-2">
              {scanHistory.slice(0, 5).map((scan: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-border last:border-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${scan.result === "success" ? "bg-emerald-500" : "bg-red-400"}`} />
                  <span className="text-foreground font-medium capitalize">{scan.scan_type}</span>
                  <span className="text-muted-foreground text-xs flex-1">
                    {scan.result === "success"
                      ? `${scan.dirs_fixed} dirs + ${scan.files_fixed} files fixed`
                      : "Error"}
                  </span>
                  <span className="text-muted-foreground text-xs shrink-0">
                    {new Date(scan.scanned_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No scans yet — run your first scan above.</p>
        )}
      </Card>

      {/* ── Performance Cache ── */}
      <Card>
        <h3 className="font-semibold text-foreground mb-1">Performance Cache</h3>
        <p className="text-sm text-muted-foreground mb-4">Toggle caching layers to boost page speed and reduce server load without touching any code.</p>
        <div className="space-y-3">
          <CacheSwitch
            label="Edge Caching (CDN)"
            description="Serve static assets from global edge nodes — 3× faster page loads worldwide."
            icon={<Globe size={16} />}
            enabled={Boolean(cache.edge_cache)}
            onChange={v => toggleCache("edge_cache", v)}
            loading={cacheLoading === "edge_cache"}
          />
          <CacheSwitch
            label="Object Cache (Redis)"
            description="Cache database queries and PHP objects in memory — ideal for WordPress & dynamic sites."
            icon={<Database size={16} />}
            enabled={Boolean(cache.object_cache)}
            onChange={v => toggleCache("object_cache", v)}
            loading={cacheLoading === "object_cache"}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
          <Info size={12} />
          Cache settings are applied instantly and saved to your account. Disable before debugging caching issues.
        </p>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: ServiceDetail
// ═══════════════════════════════════════════════════════════════════════════════
export default function ServiceDetail() {
  const [, params] = useRoute("/client/hosting/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const serviceId = params?.id;

  const [service, setService] = useState<Service | null>(null);
  const [plan, setPlan] = useState<HostingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<NavSection>("overview");

  async function fetchService() {
    try {
      const res = await authFetch(`/client/hosting/${serviceId}`);
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Not found"); }
      const d = await res.json();
      setService(d);
      // Fetch plan info
      authFetch(`/hosting/plans`).then(r => r.ok ? r.json() : null).then(data => {
        const plans: HostingPlan[] = Array.isArray(data) ? data : (data?.plans ?? []);
        const p = plans.find((pl: HostingPlan) => pl.id === d.planId);
        if (p) setPlan(p);
      }).catch(() => null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  useEffect(() => { if (serviceId) fetchService(); }, [serviceId]);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle size={40} className="text-muted-foreground" />
        <p className="text-foreground font-medium">Service not found</p>
        <Button variant="outline" onClick={() => setLocation("/client/hosting")}>Back to Hosting</Button>
      </div>
    );
  }

  const isActive = service.status === "active";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Sidebar */}
      <Sidebar active={section} onChange={setSection} service={service} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="border-b border-border bg-background px-6 py-3 flex items-center gap-3 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/client/hosting")} className="gap-1.5 text-muted-foreground">
            <ArrowLeft size={15} /> Back
          </Button>
          <div className="w-px h-4 bg-border" />
          <span className="text-sm text-muted-foreground">{service.planName}</span>
          <span className="text-sm text-muted-foreground">·</span>
          <span className="text-sm font-medium text-foreground">{service.domain || "Hosting Service"}</span>
          <div className="ml-auto flex items-center gap-2">
            {service.domain && (
              <Button variant="outline" size="sm"
                onClick={() => window.open(`https://${service.domain}`, "_blank", "noopener")}
                className="gap-1.5">
                <ExternalLink size={13} /> Visit Site
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={fetchService} className="text-muted-foreground">
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        {/* Service suspended/pending banner */}
        {!isActive && (
          <div className={`px-6 py-3 flex items-center gap-2 text-sm font-medium ${service.status === "suspended" ? "bg-orange-50 text-orange-700" : "bg-yellow-50 text-yellow-700"}`}>
            <AlertTriangle size={15} />
            Service is <strong>{service.status}</strong> — {service.manageLockReason || "Management features may be limited."}
          </div>
        )}

        {/* Section Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {section === "overview"     && <SectionOverview service={service} plan={plan} navigateTo={setSection} />}
          {section === "wordpress"    && <SectionWordPress service={service} refetch={fetchService} />}
          {section === "software"     && <SectionSoftware service={service} navigateTo={setSection} />}
          {section === "environment"  && <SectionEnvironment service={service} />}
          {section === "domains"      && <SectionDomains service={service} />}
          {section === "email"        && <SectionEmail service={service} />}
          {section === "databases"    && <SectionDatabases service={service} />}
          {section === "files"        && <SectionFiles service={service} />}
          {section === "ssl"          && <SectionSSL service={service} refetch={fetchService} />}
          {section === "ssh"          && <SectionSSH service={service} />}
          {section === "backup"       && <SectionBackup service={service} />}
          {section === "nodejs"       && <SectionNodejs service={service} />}
          {section === "python"       && <SectionPython service={service} />}
          {section === "ai-support"   && <SectionAiSupport service={service} />}
          {section === "monitor"      && <SectionMonitor service={service} />}
          {section === "staging"      && <SectionStaging service={service} />}
        </div>
      </div>
    </div>
  );
}
