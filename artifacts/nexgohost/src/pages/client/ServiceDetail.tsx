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
  AlertTriangle, AlertCircle, X, XCircle, ArrowUpCircle, CheckCircle,
  Lock, ChevronDown, ChevronUp, Network, Plus, Trash2, Pencil,
  Database, Download, ArchiveRestore, Clock,
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
  wpEmail: string | null;
  wpSiteTitle: string | null;
  wpProvisionStatus: string | null;
  wpProvisionStep: string | null;
  wpProvisionError: string | null;
  autoRenew: boolean;
}

interface DnsRecord {
  line: number;
  type: string;
  name: string;
  address: string;
  ttl: number;
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

  // WordPress guided-install state
  const [wpInstallerLoading, setWpInstallerLoading] = useState(false);
  const [wpCheckLoading, setWpCheckLoading] = useState(false);
  const [wpAdminLoading, setWpAdminLoading] = useState(false);
  const [wpProvisionData, setWpProvisionData] = useState<{
    status: string;
    step: string | null;
    error: string | null;
  } | null>(null);
  // Domain list for the WordPress installer / Sitejet domain dropdown
  const [wpDomains, setWpDomains] = useState<{ domain: string; docroot: string; type: string }[]>([]);
  const [wpDomainsLoading, setWpDomainsLoading] = useState(false);
  const [wpSelectedDomain, setWpSelectedDomain] = useState("");

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

  // Real cPanel resource usage
  const [usageData, setUsageData] = useState<{
    source: string;
    diskUsed: string | null; diskLimit?: string; diskPct: number; diskUnlimited?: boolean;
    bwUsed: string | null; bwLimit?: string; bwPct: number; bwUnlimited?: boolean;
  } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // Backup state
  type Backup = { id: string; domain: string; status: string; type: string; filePath: string | null; sqlPath: string | null; sizeMb: string | null; createdAt: string; completedAt: string | null; errorMessage: string | null };
  const [backups, setBackups] = useState<Backup[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"overview" | "dns">("overview");

  // Auto-renew
  const [autoRenewLoading, setAutoRenewLoading] = useState(false);

  // DNS state
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsError, setDnsError] = useState<string | null>(null);
  const [showAddDns, setShowAddDns] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DnsRecord | null>(null);
  const [dnsForm, setDnsForm] = useState({ type: "A", name: "", address: "", ttl: 14400 });
  const [dnsSaving, setDnsSaving] = useState(false);

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

  // Load backup history when service data arrives
  useEffect(() => {
    if (service?.id && service.status === "active") {
      fetchBackups();
      fetchUsage();
    }
  }, [service?.id]);

  // Load WordPress status from DB on service load
  useEffect(() => {
    if (!service?.id) return;
    const status = service.wpProvisionStatus;
    if (status === "active" && service.wpInstalled) {
      setWpProvisionData({ status: "active", step: "Completed", error: null });
    } else if (status === "failed") {
      setWpProvisionData({ status: "failed", step: null, error: service.wpProvisionError });
    } else {
      setWpProvisionData({ status: "not_started", step: null, error: null });
    }
  }, [service?.id]);

  // Fetch all domains/subdomains for the WordPress installer dropdown
  useEffect(() => {
    if (!service?.id || service.status !== "active") return;
    let cancelled = false;
    async function fetchDomains() {
      setWpDomainsLoading(true);
      try {
        const res = await authFetch(`/api/client/hosting/${service!.id}/domains`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const list: { domain: string; docroot: string; type: string }[] = data.domains ?? [];
        if (!cancelled) {
          setWpDomains(list);
          // Default selection: prefer main domain, fall back to first item
          const main = list.find(d => d.type === "main") ?? list[0];
          if (main) setWpSelectedDomain(main.domain);
        }
      } catch { /* non-fatal */ } finally {
        if (!cancelled) setWpDomainsLoading(false);
      }
    }
    fetchDomains();
    return () => { cancelled = true; };
  }, [service?.id, service?.status]);

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

  // Open the official cPanel Softaculous WordPress installer in a new tab
  // Passes the selected domain so Softaculous pre-selects it
  async function handleOpenSoftaculous() {
    if (!service) return;
    setWpInstallerLoading(true);
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/wp-softaculous-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: wpSelectedDomain || service.domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate installer URL");
      window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "Cannot open installer", description: e.message, variant: "destructive" });
    } finally {
      setWpInstallerLoading(false);
    }
  }

  // Detect WordPress by checking for wp-config.php in the selected domain's directory
  async function handleDetectWordPress() {
    if (!service) return;
    setWpCheckLoading(true);
    const checkDomain = wpSelectedDomain || service.domain;
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/wp-detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: checkDomain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Detection failed");
      if (data.installed) {
        setWpProvisionData({ status: "active", step: "Completed", error: null });
        fetchService();
        toast({ title: "WordPress Detected", description: `WordPress found on ${checkDomain}.` });
      } else {
        toast({
          title: "Not found yet",
          description: `wp-config.php was not found in ${data.checkedDir ?? "the selected directory"}. Complete the installation in Softaculous first.`,
        });
      }
    } catch (e: any) {
      toast({ title: "Detection failed", description: e.message, variant: "destructive" });
    } finally {
      setWpCheckLoading(false);
    }
  }

  // Open WordPress admin — tries Softaculous SSO first, falls back to direct /wp-admin
  async function handleOpenWpAdmin() {
    if (!service) return;
    setWpAdminLoading(true);
    const adminDomain = wpSelectedDomain || service.domain;
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/wp-admin-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: adminDomain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not get admin URL");
      window.open(data.url, "_blank");
    } catch (e: any) {
      // Last resort: open /wp-admin directly on the selected domain
      window.open(`https://${adminDomain}/wp-admin`, "_blank");
    } finally {
      setWpAdminLoading(false);
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

  async function fetchBackups() {
    if (!service) return;
    setBackupsLoading(true);
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/backups`);
      if (res.ok) setBackups(await res.json());
    } catch { /* non-fatal */ } finally { setBackupsLoading(false); }
  }

  async function handleDeleteBackup(backupId: string) {
    if (!service || !confirm("Remove this backup record?")) return;
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/backup/${backupId}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Delete failed"); }
      toast({ title: "Backup removed" });
      fetchBackups();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleCreateDbBackup() {
    if (!service) return;
    setCreatingBackup(true);
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/backup`, { method: "POST", body: JSON.stringify({ backupType: "db_only" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Backup failed");
      toast({ title: "Database backup started", description: "Your database backup is being created." });
      const poll = setInterval(async () => {
        const r = await authFetch(`/api/client/hosting/${service!.id}/backup/${data.backupId}`);
        if (!r.ok) { clearInterval(poll); return; }
        const b = await r.json();
        if (b.status !== "running") {
          clearInterval(poll); setCreatingBackup(false); fetchBackups();
          if (b.status === "queued_on_server") toast({ title: "DB backup queued", description: `File: ${b.filePath || "~/cpanel_backups/"}` });
          else if (b.status === "completed") toast({ title: "DB backup complete" });
          else toast({ title: "DB backup failed", description: b.errorMessage || "Unknown error", variant: "destructive" });
        }
      }, 3000);
    } catch (e: any) {
      toast({ title: "Backup error", description: e.message, variant: "destructive" });
      setCreatingBackup(false);
    }
  }

  async function fetchUsage() {
    if (!service) return;
    setUsageLoading(true);
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/usage`);
      if (res.ok) {
        const data = await res.json();
        setUsageData(data);
      }
    } catch { /* non-fatal — falls back to simulated */ } finally { setUsageLoading(false); }
  }

  async function handleCreateBackup() {
    if (!service) return;
    setCreatingBackup(true);
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/backup`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Backup failed");
      toast({ title: "Backup started", description: "Your backup is being created in the background." });
      // Poll until it transitions from "running"
      const poll = setInterval(async () => {
        const r = await authFetch(`/api/client/hosting/${service!.id}/backup/${data.backupId}`);
        if (!r.ok) { clearInterval(poll); return; }
        const b = await r.json();
        if (b.status !== "running") {
          clearInterval(poll);
          setCreatingBackup(false);
          fetchBackups();
          if (b.status === "completed") toast({ title: "Backup complete", description: `${b.sizeMb ? b.sizeMb + " MB" : "Files"} backed up successfully.` });
          else if (b.status === "queued_on_server") toast({ title: "Backup queued on server", description: `cPanel accepted the backup. File: ${b.filePath || "~/backup-*.tar.gz"}` });
          else toast({ title: "Backup failed", description: b.errorMessage || "Unknown error", variant: "destructive" });
        }
      }, 3000);
    } catch (e: any) {
      toast({ title: "Backup error", description: e.message, variant: "destructive" });
      setCreatingBackup(false);
    }
  }


  async function handleToggleAutoRenew() {
    if (!service) return;
    setAutoRenewLoading(true);
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/auto-renew`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRenew: !service.autoRenew }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setService(s => s ? { ...s, autoRenew: !s.autoRenew } : s);
      toast({ title: `Auto-Renew ${!service.autoRenew ? "Enabled" : "Disabled"}`, description: !service.autoRenew ? "Your service will renew automatically." : "Auto-renewal has been disabled." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setAutoRenewLoading(false); }
  }

  async function fetchDns() {
    if (!service) return;
    setDnsLoading(true);
    setDnsError(null);
    try {
      const res = await authFetch(`/api/hosting/${service.id}/dns`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load DNS");
      setDnsRecords(data.records ?? []);
    } catch (e: any) {
      setDnsError(e.message);
    } finally { setDnsLoading(false); }
  }

  async function handleAddDns() {
    if (!service) return;
    setDnsSaving(true);
    try {
      const res = await authFetch(`/api/hosting/${service.id}/dns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dnsForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add record");
      toast({ title: "DNS Record Added" });
      setShowAddDns(false);
      setDnsForm({ type: "A", name: "", address: "", ttl: 14400 });
      fetchDns();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setDnsSaving(false); }
  }

  async function handleEditDns() {
    if (!service || !editingRecord) return;
    setDnsSaving(true);
    try {
      const res = await authFetch(`/api/hosting/${service.id}/dns/${editingRecord.line}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dnsForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update record");
      toast({ title: "DNS Record Updated" });
      setEditingRecord(null);
      fetchDns();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setDnsSaving(false); }
  }

  async function handleDeleteDns(line: number) {
    if (!service) return;
    try {
      const res = await authFetch(`/api/hosting/${service.id}/dns/${line}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast({ title: "DNS Record Deleted" });
      fetchDns();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
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
  const planDiskLimit = currentPlan?.diskSpace || "10 GB";
  const planBwLimit = currentPlan?.bandwidth || "100 GB";
  const diskLimitNum = planDiskLimit.replace(/[^0-9.]/g, "");
  const bwLimitNum = planBwLimit.replace(/[^0-9.]/g, "");

  const diskSim = simulateUsage(service.id, diskLimitNum, "disk");
  const bwSim = simulateUsage(service.id, bwLimitNum, "bw");
  const hasRealUsage = (usageData?.source === "cpanel" || usageData?.source === "cached") && (usageData.diskUsed !== null || usageData.bwUsed !== null);
  const diskUsedDisplay = hasRealUsage ? (usageData!.diskUsed ?? "0 MB") : (service.diskUsed || diskSim.display);
  const bwUsedDisplay = hasRealUsage ? (usageData!.bwUsed ?? "0 MB") : (service.bandwidthUsed || bwSim.display);
  const diskPct = hasRealUsage ? usageData!.diskPct : (service.diskUsed ? parseUsagePercent(service.diskUsed, diskLimitNum) : diskSim.pct);
  const bwPct = hasRealUsage ? usageData!.bwPct : (service.bandwidthUsed ? parseUsagePercent(service.bandwidthUsed, bwLimitNum) : bwSim.pct);
  // Use live limits from API when available, otherwise fall back to plan limits
  const diskLimit = (hasRealUsage && usageData?.diskLimit) ? usageData.diskLimit : planDiskLimit;
  const bwLimit = (hasRealUsage && usageData?.bwLimit) ? usageData.bwLimit : planBwLimit;

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

      {/* Pending payment banner */}
      {service.status === "pending" && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <AlertCircle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-yellow-400">Service pending — payment required</p>
            <p className="text-xs text-muted-foreground mt-0.5">All management features are disabled until payment is complete. View your invoice to pay and activate this service.</p>
          </div>
          <button onClick={() => setLocation("/client/invoices")} className="shrink-0 text-xs font-medium text-yellow-400 hover:text-yellow-300 underline underline-offset-2">
            View invoices
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl border border-border/50 w-fit">
        {[
          { id: "overview" as const, label: "Overview", icon: Server },
          { id: "dns" as const, label: "DNS Manager", icon: Network },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === "dns" && dnsRecords.length === 0 && !dnsLoading) fetchDns();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "dns" && (
        <div className="space-y-4">
          {/* DNS Manager */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Network size={18} className="text-primary" />
                <h3 className="font-semibold text-foreground">DNS Zone Records</h3>
                {service.domain && <span className="text-sm text-muted-foreground">— {service.domain}</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={fetchDns} disabled={dnsLoading} className="gap-1.5">
                  {dnsLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Refresh
                </Button>
                <Button size="sm" onClick={() => { setShowAddDns(true); setEditingRecord(null); setDnsForm({ type: "A", name: "", address: "", ttl: 14400 }); }} className="gap-1.5 bg-primary hover:bg-primary/90">
                  <Plus size={13} /> Add Record
                </Button>
              </div>
            </div>

            {/* Add/Edit Form */}
            {(showAddDns || editingRecord) && (
              <div className="p-5 border-b border-border/50 bg-secondary/20">
                <p className="text-sm font-semibold text-foreground mb-3">{editingRecord ? "Edit DNS Record" : "Add DNS Record"}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Type</label>
                    <select
                      value={dnsForm.type}
                      onChange={e => setDnsForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Name</label>
                    <Input value={dnsForm.name} onChange={e => setDnsForm(f => ({ ...f, name: e.target.value }))} placeholder="@ or subdomain" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-xs text-muted-foreground font-medium">Address / Value</label>
                    <Input value={dnsForm.address} onChange={e => setDnsForm(f => ({ ...f, address: e.target.value }))} placeholder="192.168.1.1" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">TTL (seconds)</label>
                    <Input type="number" value={dnsForm.ttl} onChange={e => setDnsForm(f => ({ ...f, ttl: parseInt(e.target.value) || 14400 }))} className="h-8 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={editingRecord ? handleEditDns : handleAddDns} disabled={dnsSaving || !dnsForm.name || !dnsForm.address} className="gap-1.5">
                    {dnsSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    {editingRecord ? "Save Changes" : "Add Record"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowAddDns(false); setEditingRecord(null); }}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Records Table */}
            {dnsLoading ? (
              <div className="flex justify-center p-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
            ) : dnsError ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">{dnsError}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">DNS management requires a cPanel server to be configured for this service.</p>
              </div>
            ) : dnsRecords.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No DNS records found. Add your first record above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/30 text-left">
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Address / Value</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">TTL</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {dnsRecords.map(rec => (
                      <tr key={rec.line} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 font-mono">{rec.type}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-foreground truncate max-w-[160px]">{rec.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[200px]">{rec.address}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{rec.ttl}s</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => { setEditingRecord(rec); setShowAddDns(false); setDnsForm({ type: rec.type, name: rec.name, address: rec.address, ttl: rec.ttl }); }}
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteDns(rec.line)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "overview" && <>

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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Resource Usage</h3>
          {usageLoading ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 size={11} className="animate-spin" /> Fetching live data…</span>
          ) : hasRealUsage ? (
            <span className="flex items-center gap-1.5 text-xs text-green-400"><div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live from cPanel</span>
          ) : null}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { label: "Disk Usage", used: diskUsedDisplay, limit: diskLimit, pct: diskPct, unlimited: usageData?.diskUnlimited, icon: HardDrive },
            { label: "Bandwidth", used: bwUsedDisplay, limit: bwLimit, pct: bwPct, unlimited: usageData?.bwUnlimited, icon: Activity },
          ].map(({ label, used, limit, pct, unlimited, icon: Icon }) => (
            <div key={label}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Icon size={14} /> {label}
                </div>
                <span className="text-sm font-medium text-foreground">{used} / {unlimited ? "Unlimited" : limit}</span>
              </div>
              {unlimited ? (
                <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-full rounded-full bg-primary opacity-20" />
                </div>
              ) : (
                <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct > 80 ? "bg-red-400" : pct > 60 ? "bg-yellow-400" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {unlimited ? "Unlimited — no quota" : `${pct}% used`}
              </div>
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

      {/* WordPress — Guided Installation via cPanel Softaculous */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <LayoutGrid size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">WordPress</h3>
            {wpProvisionData?.status === "active" ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                <CheckCircle2 size={11} /> Installed
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
                Not Installed
              </span>
            )}
          </div>
        </div>

        {/* Domain selector — shown in all states when multiple domains are available */}
        {wpDomains.length > 1 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/70">Domain / Subdomain</label>
            <select
              value={wpSelectedDomain}
              onChange={e => setWpSelectedDomain(e.target.value)}
              className="w-full max-w-sm h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              disabled={wpDomainsLoading}
            >
              {wpDomains.map(d => (
                <option key={d.domain} value={d.domain}>
                  {d.domain}{d.type === "main" ? " (main)" : d.type === "sub" ? " (subdomain)" : " (addon)"}
                </option>
              ))}
            </select>
            {wpDomainsLoading && <p className="text-xs text-muted-foreground">Loading domains…</p>}
          </div>
        )}

        {/* ─── Installed: show WordPress Admin button ─── */}
        {wpProvisionData?.status === "active" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              WordPress is installed. Use the button below for one-click login to your WordPress dashboard
              {wpSelectedDomain ? <> on <strong className="text-foreground">{wpSelectedDomain}</strong></> : ""}.
            </p>
            <Button onClick={handleOpenWpAdmin} disabled={wpAdminLoading} className="gap-2">
              {wpAdminLoading ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
              {wpAdminLoading ? "Opening…" : "WordPress Admin"}
            </Button>
          </div>
        ) : (
          /* ─── Not installed: guided install flow ─── */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Install WordPress on{" "}
              <strong className="text-foreground">{wpSelectedDomain || service.domain}</strong>{" "}
              using the official cPanel Softaculous installer, then click{" "}
              <strong className="text-foreground">Check if Installed</strong> to confirm.
            </p>

            {/* Step 1 */}
            <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Step 1 — Open Softaculous Installer</p>
              <p className="text-xs text-muted-foreground">
                Opens the cPanel Softaculous WordPress installer in a new tab
                {wpSelectedDomain ? <>, pre-selecting <strong>{wpSelectedDomain}</strong></> : ""}.
                Complete the installation there and return here.
              </p>
              <Button
                onClick={handleOpenSoftaculous}
                disabled={wpInstallerLoading || service.status !== "active"}
                className="gap-2 mt-1"
              >
                {wpInstallerLoading ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
                {wpInstallerLoading ? "Opening…" : "Install WordPress via cPanel"}
              </Button>
              {service.status !== "active" && (
                <p className="text-xs text-orange-400">Service must be active to open the installer.</p>
              )}
            </div>

            {/* Step 2 */}
            <div className="bg-secondary/40 border border-border rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Step 2 — Confirm Installation</p>
              <p className="text-xs text-muted-foreground">
                After finishing the Softaculous installer, click below to verify WordPress is present
                {wpSelectedDomain ? <> in the <strong>{wpSelectedDomain}</strong> directory</> : ""}.
              </p>
              <Button
                variant="outline"
                onClick={handleDetectWordPress}
                disabled={wpCheckLoading || service.status !== "active"}
                className="gap-2 mt-1"
              >
                {wpCheckLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                {wpCheckLoading ? "Checking…" : "Check if Installed"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Backup System ─── */}
      {service.status === "active" && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
                <ArchiveRestore size={18} className="text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Backups</p>
                <p className="text-sm text-muted-foreground">
                  Daily automatic backups run at 2 AM. Create a manual backup at any time.
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateDbBackup}
                disabled={creatingBackup || service.status !== "active"}
                className="gap-1.5 text-xs"
              >
                {creatingBackup ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                DB Only
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateBackup}
                disabled={creatingBackup || service.status !== "active"}
                className="gap-1.5"
              >
                {creatingBackup ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {creatingBackup ? "Creating…" : "Full Backup"}
              </Button>
            </div>
          </div>

          {/* Backup list */}
          {backupsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={13} className="animate-spin" /> Loading backups…
            </div>
          ) : backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No backups yet. Click "Full Backup" to create your first one.</p>
          ) : (
            <div className="space-y-2">
              {backups.slice(0, 8).map(b => {
                const isQueued = b.status === "queued_on_server";
                const isDone = b.status === "completed";
                const isFailed = b.status === "failed";
                return (
                  <div key={b.id} className="py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isDone ? "bg-green-400" : isQueued ? "bg-blue-400" : isFailed ? "bg-red-400" : "bg-yellow-400 animate-pulse"}`} />
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">
                            {b.type === "cron" ? "Scheduled" : b.type === "db_only" ? "Database" : "Full"} backup
                            {b.sizeMb ? ` — ${b.sizeMb} MB` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock size={10} />
                            {format(new Date(b.createdAt), "MMM d, yyyy · HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          isDone    ? "bg-green-500/10 text-green-400 border-green-500/20" :
                          isQueued  ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          isFailed  ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                      "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                        }`}>
                          {isDone ? "Done" : isQueued ? "On Server" : isFailed ? "Failed" : "Running"}
                        </span>
                        <button onClick={() => handleDeleteBackup(b.id)} className="text-muted-foreground hover:text-destructive transition-colors" title="Remove">
                          <XCircle size={14} />
                        </button>
                      </div>
                    </div>
                    {isQueued && b.filePath && (
                      <p className="text-xs text-blue-400/80 mt-1 ml-4.5 pl-5">
                        File queued: <span className="font-mono">{b.filePath}</span> — check cPanel File Manager
                      </p>
                    )}
                    {isFailed && b.errorMessage && (
                      <p className="text-xs text-red-400/80 mt-1 ml-4.5 pl-5 flex items-center gap-1">
                        <AlertCircle size={10} /> {b.errorMessage}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Auto-Renew */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${service.autoRenew ? "bg-green-500/10 border border-green-500/20" : "bg-secondary/60 border border-border"}`}>
              <RefreshCw size={18} className={service.autoRenew ? "text-green-400" : "text-muted-foreground"} />
            </div>
            <div>
              <p className="font-semibold text-foreground">Auto-Renew</p>
              <p className="text-sm text-muted-foreground">
                {service.autoRenew ? "Service will renew automatically before expiry." : "Service will not renew automatically."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${service.autoRenew ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-secondary text-muted-foreground border-border"}`}>
              {service.autoRenew ? "Enabled" : "Disabled"}
            </span>
            <Button
              size="sm"
              variant={service.autoRenew ? "outline" : "default"}
              onClick={handleToggleAutoRenew}
              disabled={autoRenewLoading || service.status === "terminated"}
              className={service.autoRenew ? "border-red-500/30 text-red-400 hover:bg-red-500/5" : ""}
            >
              {autoRenewLoading ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {service.autoRenew ? "Disable" : "Enable"}
            </Button>
          </div>
        </div>
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

      </>}
    </div>
  );
}
