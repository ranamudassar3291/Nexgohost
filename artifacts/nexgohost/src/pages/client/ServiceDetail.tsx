import { useState, useEffect, useCallback } from "react";
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
  Network,
} from "lucide-react";
import { format } from "date-fns";

// ─── Config ───────────────────────────────────────────────────────────────────
const API = "";

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  return fetch(url, {
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
type NavSection = "overview" | "wordpress" | "domains" | "email" | "databases" | "files" | "ssl" | "backup" | "ssh" | "nodejs" | "python";

// ─── Sidebar Nav ─────────────────────────────────────────────────────────────
const NAV_ITEMS: { id: NavSection; label: string; icon: React.ElementType; group?: string }[] = [
  { id: "overview",   label: "Overview",       icon: LayoutDashboard, group: "Hosting" },
  { id: "wordpress",  label: "WordPress",      icon: Boxes,           group: "Hosting" },
  { id: "domains",    label: "Domains & DNS",  icon: Globe,           group: "Hosting" },
  { id: "email",      label: "Email",          icon: Mail,            group: "Hosting" },
  { id: "databases",  label: "Databases",      icon: Database,        group: "Hosting" },
  { id: "files",      label: "File Manager",   icon: FolderOpen,      group: "Hosting" },
  { id: "ssl",        label: "SSL",            icon: ShieldCheck,     group: "Security" },
  { id: "ssh",        label: "SSH Access",     icon: Terminal,        group: "Security" },
  { id: "backup",     label: "Backups",        icon: ArchiveRestore,  group: "Tools" },
  { id: "nodejs",     label: "Node.js",        icon: Code2,           group: "Tools" },
  { id: "python",     label: "Python",         icon: Cpu,             group: "Tools" },
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
                  <span>{item.label}</span>
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

// ─── SSO Launch Helper ────────────────────────────────────────────────────────
async function ssoLaunch(serviceId: string, target: string, toast: any) {
  try {
    const data = await apiFetch(`/client/hosting/${serviceId}/sso-launch`, {
      method: "POST", body: JSON.stringify({ target }),
    });
    if (data.url) window.open(data.url, "_blank", "noopener");
    else toast({ title: "Error", description: "No URL returned", variant: "destructive" });
  } catch (err: any) {
    toast({ title: "Could not open", description: err.message, variant: "destructive" });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function SectionOverview({ service, plan, onSsoLaunch }: { service: Service; plan: HostingPlan | null; onSsoLaunch: (target: string) => void }) {
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

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "cPanel", icon: LayoutDashboard, target: "cpanel", color: "text-violet-600 bg-violet-50" },
          { label: "File Manager", icon: FolderOpen, target: "filemanager", color: "text-blue-600 bg-blue-50" },
          { label: "Email", icon: Mail, target: "email", color: "text-emerald-600 bg-emerald-50" },
          { label: "Databases", icon: Database, target: "databases", color: "text-amber-600 bg-amber-50" },
        ].map(a => (
          <button key={a.target} onClick={() => onSsoLaunch(a.target)}
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
            { label: "SSL", value: ["active", "installed"].includes(service.sslStatus) ? "Active ✓" : "Not installed" },
          ].map(row => (
            <div key={row.label} className="flex justify-between border-b border-border pb-2 last:border-0">
              <span className="text-muted-foreground">{row.label}</span>
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
              <Button size="sm" onClick={handleWpAdmin} disabled={loading === "wpadmin"} className="gap-1.5 bg-primary hover:bg-primary/90">
                {loading === "wpadmin" ? <Loader2 size={13} className="animate-spin" /> : <Settings size={13} />} WP Admin
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {service.wpUsername && <div className="bg-muted rounded-lg p-3"><p className="text-muted-foreground text-xs">Admin User</p><p className="font-medium mt-0.5">{service.wpUsername}</p></div>}
            {service.wpEmail && <div className="bg-muted rounded-lg p-3"><p className="text-muted-foreground text-xs">Admin Email</p><p className="font-medium mt-0.5">{service.wpEmail}</p></div>}
          </div>
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
function SectionEmail({ service }: { service: Service }) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", quota: "250" });
  const [showPwd, setShowPwd] = useState(false);
  const [changePwd, setChangePwd] = useState<{ email: string; pwd: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const isWHM = !service.twentyIPackageId && service.serverId;

  async function loadAccounts() {
    setLoadingList(true);
    try {
      const d = await apiFetch(`/client/hosting/${service.id}/email`);
      setAccounts(d.accounts || []);
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setLoadingList(false); }
  }

  useEffect(() => { if (isWHM) loadAccounts(); else setLoadingList(false); }, [service.id]);

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

  async function handleChangePwd() {
    if (!changePwd) return;
    try {
      await apiFetch(`/client/hosting/${service.id}/email/password`, { method: "PUT", body: JSON.stringify({ email: changePwd.email, password: changePwd.pwd }) });
      toast({ title: "Password updated" }); setChangePwd(null);
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
  }

  if (!isWHM) return <NotAvailable reason="Email management via this panel requires a cPanel/WHM server. Use the cPanel button for email management." />;

  return (
    <div className="space-y-5">
      <SectionHeader title="Email Accounts" description="Create and manage email accounts for your domain"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleWebmail} className="gap-1.5"><ExternalLink size={13} />Webmail</Button>
            <Button size="sm" onClick={() => setShowCreate(s => !s)} className="gap-1.5 bg-primary hover:bg-primary/90"><Plus size={13} />Create Email</Button>
          </div>
        } />

      {showCreate && (
        <Card>
          <h3 className="font-semibold text-foreground mb-4">Create Email Account</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email Address</label>
              <Input placeholder={`info@${service.domain || "yourdomain.com"}`} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Password</label>
              <div className="relative">
                <Input type={showPwd ? "text" : "password"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Quota (MB)</label>
              <Input type="number" value={form.quota} onChange={e => setForm(f => ({ ...f, quota: e.target.value }))} />
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
        {loadingList ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
        ) : accounts.length === 0 ? (
          <EmptyState icon={Mail} title="No email accounts" description="Create your first email account above" />
        ) : (
          <div className="divide-y divide-border">
            {accounts.map(acc => (
              <div key={acc.email} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <AtSign size={14} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{acc.email}</p>
                    <p className="text-xs text-muted-foreground">{acc.diskquota || "Unlimited"} quota</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setChangePwd({ email: acc.email, pwd: "" })}
                    className="text-muted-foreground hover:text-foreground"><KeyRound size={14} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.email)} disabled={deleting === acc.email}
                    className="text-destructive hover:text-destructive">
                    {deleting === acc.email ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {changePwd && (
        <Card>
          <h3 className="font-semibold text-foreground mb-3">Change Password — {changePwd.email}</h3>
          <div className="flex gap-2">
            <Input type="password" placeholder="New password" value={changePwd.pwd} onChange={e => setChangePwd(c => c ? { ...c, pwd: e.target.value } : null)} className="flex-1" />
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
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ suffix: "", password: "" });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pmaLoading, setPmaLoading] = useState(false);

  const isWHM = !service.twentyIPackageId && service.serverId;

  async function loadDbs() {
    setLoading(true);
    try { const d = await apiFetch(`/client/hosting/${service.id}/databases`); setDbs(d.databases || []); }
    catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
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

  if (!isWHM) return <NotAvailable reason="Database management requires a cPanel/WHM server. Use the cPanel button to access databases." />;

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
function SectionFiles({ service }: { service: Service }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  async function openFileManager() {
    setLoading(true);
    try { await ssoLaunch(service.id, "filemanager", toast); }
    finally { setLoading(false); }
  }
  return (
    <div className="space-y-5">
      <SectionHeader title="File Manager" description="Browse and manage your hosting files" />
      <Card>
        <div className="flex flex-col items-center py-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
            <FolderOpen size={28} className="text-blue-600" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Open File Manager</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">Upload, edit, delete files and folders directly in your hosting account's public_html directory.</p>
          <Button onClick={openFileManager} disabled={loading} className="gap-2 bg-primary hover:bg-primary/90">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <FolderOpen size={15} />}
            Open File Manager
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 border-t border-border pt-4">
          {["Upload Files", "Edit Files", "Create Folder", "Delete Files"].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> {f}
            </div>
          ))}
        </div>
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

  async function handleInstallSSL() {
    setLoading(true);
    try {
      const res = await authFetch(`/client/hosting/${service.id}/reinstall-ssl`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast({ title: "SSL installation initiated", description: "Please wait a moment and then check your site." });
      setTimeout(() => refetch(), 4000);
    } catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  const isActive = ["active", "installed"].includes(service.sslStatus);
  return (
    <div className="space-y-5">
      <SectionHeader title="SSL Certificate" description="Manage SSL/TLS security for your domain" />
      <Card>
        <div className="flex items-center gap-4 mb-5">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? "bg-emerald-50" : "bg-orange-50"}`}>
            {isActive ? <ShieldCheck size={22} className="text-emerald-600" /> : <ShieldX size={22} className="text-orange-500" />}
          </div>
          <div>
            <p className="font-semibold text-foreground">{isActive ? "SSL Active" : "SSL Not Installed"}</p>
            <p className="text-sm text-muted-foreground">{isActive ? "Your site is secured with HTTPS" : "Your site is not using HTTPS"}</p>
          </div>
          <div className="ml-auto">
            <Badge className={isActive ? "bg-[#D1FAE5] text-[#065F46]" : "bg-orange-50 text-orange-700"}>{isActive ? "Active" : "Not Installed"}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleInstallSSL} disabled={loading} variant={isActive ? "outline" : "default"}
            className={isActive ? "" : "bg-primary hover:bg-primary/90"}>
            {loading ? <Loader2 size={14} className="animate-spin mr-2" /> : <ShieldCheck size={14} className="mr-2" />}
            {isActive ? "Reinstall SSL" : "Install Free SSL"}
          </Button>
        </div>
      </Card>
      <Card>
        <h3 className="font-semibold text-foreground mb-3">SSL Features</h3>
        <div className="space-y-2">
          {["Free Let's Encrypt SSL certificate", "Auto-renewal before expiry", "HTTPS encryption for all traffic", "Trust indicators in browser"].map(f => (
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
  const [toggling, setToggling] = useState(false);

  const isWHM = !service.twentyIPackageId;

  async function loadStatus() {
    setLoading(true);
    try { const d = await apiFetch(`/client/hosting/${service.id}/ssh`); setStatus(d); }
    catch (e: any) { toast({ description: e.message, variant: "destructive" }); }
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

  if (!isWHM) return <NotAvailable reason="SSH management requires a cPanel/WHM server." />;

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
  type Backup = { id: string; domain: string; status: string; type: string; filePath: string | null; sizeMb: string | null; createdAt: string; completedAt: string | null; errorMessage: string | null };
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

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
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[b.status] || "text-muted-foreground bg-muted"}`}>{b.status.replace(/_/g, " ")}</span>
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

  if (!isWHM) return <NotAvailable reason="Node.js app management requires a cPanel/WHM server with Node.js Selector enabled." />;

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

  if (!isWHM) return <NotAvailable reason="Python app management requires a cPanel/WHM server with Python Selector enabled." />;

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
            {apps.map(app => (
              <div key={app.app_name} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${app.enabled ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                    <div>
                      <p className="font-medium text-sm text-foreground">{app.app_name}</p>
                      <p className="text-xs text-muted-foreground">{app.app_root} · Python {app.python_version} · URI: {app.app_uri}</p>
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
              </div>
            ))}
          </div>
        )}
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

  async function handleSsoLaunch(target: string) {
    await ssoLaunch(serviceId!, target, toast);
  }

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
            <Button variant="outline" size="sm" onClick={() => handleSsoLaunch("cpanel")} className="gap-1.5">
              <ExternalLink size={13} /> cPanel
            </Button>
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
          {section === "overview"   && <SectionOverview service={service} plan={plan} onSsoLaunch={handleSsoLaunch} />}
          {section === "wordpress"  && <SectionWordPress service={service} refetch={fetchService} />}
          {section === "domains"    && <SectionDomains service={service} />}
          {section === "email"      && <SectionEmail service={service} />}
          {section === "databases"  && <SectionDatabases service={service} />}
          {section === "files"      && <SectionFiles service={service} />}
          {section === "ssl"        && <SectionSSL service={service} refetch={fetchService} />}
          {section === "ssh"        && <SectionSSH service={service} />}
          {section === "backup"     && <SectionBackup service={service} />}
          {section === "nodejs"     && <SectionNodejs service={service} />}
          {section === "python"     && <SectionPython service={service} />}
        </div>
      </div>
    </div>
  );
}
