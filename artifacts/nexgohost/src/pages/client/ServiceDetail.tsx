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
  Database, Download, Wand2, ArchiveRestore, Clock,
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

  // WordPress installer state
  const [wpLoading, setWpLoading] = useState(false);
  const [wpPolling, setWpPolling] = useState(false);
  const [showWpCredentials, setShowWpCredentials] = useState(false);
  const [wpSiteTitle, setWpSiteTitle] = useState("My WordPress Site");
  const [wpAdminUsername, setWpAdminUsername] = useState("");
  const [wpAdminPassword, setWpAdminPassword] = useState("");
  const [wpAdminEmail, setWpAdminEmail] = useState("");
  const [wpInstallPath, setWpInstallPath] = useState("/");
  const [showWpPassInForm, setShowWpPassInForm] = useState(false);
  const [showReinstallConfirm, setShowReinstallConfirm] = useState(false);
  const [wpReinstallLoading, setWpReinstallLoading] = useState(false);
  const [wpProvisionData, setWpProvisionData] = useState<{
    status: string;
    step: string | null;
    error: string | null;
    credentials?: { loginUrl: string | null; username: string | null; password: string | null; email: string | null; siteTitle: string | null; installPath?: string | null; insid?: string | null };
  } | null>(null);

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

  // Backup state
  type Backup = { id: string; domain: string; status: string; type: string; filePath: string | null; sqlPath: string | null; sizeMb: string | null; createdAt: string; completedAt: string | null; errorMessage: string | null };
  const [backups, setBackups] = useState<Backup[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // AI Builder state
  const [aiBuilderLoading, setAiBuilderLoading] = useState(false);

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
    }
  }, [service?.id]);

  // Verify WordPress status from server on every service load (never trust local state alone)
  useEffect(() => {
    if (!service?.id) return;
    let cancelled = false;
    async function checkWpStatus() {
      try {
        const res = await authFetch(`/api/client/hosting/${service!.id}/wordpress-status`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setWpProvisionData(data);
        // If actively provisioning, kick off polling
        if (data.status === "queued" || data.status === "provisioning") {
          setWpPolling(true);
        }
      } catch {
        // Network error: fall back to DB data so UI doesn't break
        const status = service!.wpProvisionStatus;
        if (status === "queued" || status === "provisioning") {
          setWpProvisionData({ status, step: service!.wpProvisionStep, error: null });
          setWpPolling(true);
        } else if (status === "active" && service!.wpInstalled) {
          setWpProvisionData({
            status: "active",
            step: "Completed",
            error: null,
            credentials: {
              loginUrl: service!.wpUrl,
              username: service!.wpUsername,
              password: service!.wpPassword,
              email: service!.wpEmail,
              siteTitle: service!.wpSiteTitle,
            },
          });
        } else if (status === "failed") {
          setWpProvisionData({ status: "failed", step: null, error: service!.wpProvisionError });
        }
      }
    }
    checkWpStatus();
    return () => { cancelled = true; };
  }, [service?.id]);

  // Poll /wordpress-status while install is in progress
  useEffect(() => {
    if (!wpPolling || !serviceId) return;
    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`/api/client/hosting/${serviceId}/wordpress-status`);
        if (!res.ok) return;
        const data = await res.json();
        setWpProvisionData(data);
        if (data.status === "active" || data.status === "failed") {
          setWpPolling(false);
          fetchService();
          if (data.status === "active") {
            toast({ title: "WordPress Installed", description: "Your WordPress site is ready!" });
          }
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [wpPolling, serviceId]);

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

  function generateWpCredentials() {
    if (!service?.domain) return;
    const base = (service.domain.split(".")[0] || "admin").replace(/[^a-zA-Z0-9]/g, "").substring(0, 8);
    setWpAdminUsername(`${base}${Math.floor(100 + Math.random() * 900)}`);
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const pass = `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 10)}!` +
      Array.from({ length: 11 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setWpAdminPassword(pass);
    if (service.domain) setWpAdminEmail(`admin@${service.domain}`);
  }

  async function handleInstallWordPress() {
    if (!service) return;
    setWpLoading(true);

    // Start the progress bar immediately — the POST is now synchronous and may
    // take up to ~2 minutes on a real VPS. Polling keeps the UI alive during that time.
    setWpProvisionData({ status: "queued", step: "Queued", error: null });
    setWpPolling(true);

    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/install-wordpress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteTitle: wpSiteTitle,
          adminUsername: wpAdminUsername || undefined,
          adminPassword: wpAdminPassword || undefined,
          adminEmail: wpAdminEmail || undefined,
          installPath: wpInstallPath,
        }),
      });
      const data = await res.json();

      // Already installed — jump straight to credentials view
      if (res.status === 409 && data.alreadyInstalled) {
        setWpPolling(false);
        const statusRes = await authFetch(`/api/client/hosting/${service.id}/wordpress-status`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setWpProvisionData(statusData);
        }
        return;
      }

      if (!res.ok) {
        // Exact error returned synchronously from the server
        const errorMsg = data.error || "Installation failed";
        setWpPolling(false);
        setWpProvisionData({ status: "failed", step: null, error: errorMsg });
        toast({ title: "Installation failed", description: errorMsg, variant: "destructive" });
        return;
      }

      // POST returned 200 with credentials — installation fully complete
      if (data.installed && data.credentials) {
        setWpPolling(false);
        setWpProvisionData({
          status: "active",
          step: "Completed",
          error: null,
          credentials: {
            loginUrl:    data.credentials.loginUrl,
            username:    data.credentials.username,
            password:    data.credentials.password,
            email:       data.credentials.email,
            siteTitle:   data.credentials.siteTitle,
            installPath: data.credentials.installPath,
            insid:       data.credentials.insid ?? null,   // Softaculous Installation ID
          },
        });
        toast({ title: "WordPress Installed", description: "Your WordPress site is ready!" });
        fetchService();
      }
      // If server returned success but no credentials yet, polling will pick it up
    } catch (e: any) {
      setWpPolling(false);
      setWpProvisionData({ status: "failed", step: null, error: e.message });
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setWpLoading(false);
    }
  }

  async function handleReinstallWordPress() {
    if (!service) return;
    setWpReinstallLoading(true);
    setShowReinstallConfirm(false);

    // Start progress bar immediately — POST is synchronous
    setWpProvisionData({ status: "queued", step: "Queued", error: null });
    setWpPolling(true);

    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/reinstall-wordpress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteTitle: wpSiteTitle,
          adminUsername: wpAdminUsername || undefined,
          adminPassword: wpAdminPassword || undefined,
          adminEmail: wpAdminEmail || undefined,
          installPath: wpInstallPath,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error || "Reinstall failed";
        setWpPolling(false);
        setWpProvisionData({ status: "failed", step: null, error: errorMsg });
        toast({ title: "Reinstall failed", description: errorMsg, variant: "destructive" });
        return;
      }

      if (data.installed && data.credentials) {
        setWpPolling(false);
        setWpProvisionData({
          status: "active",
          step: "Completed",
          error: null,
          credentials: {
            loginUrl:    data.credentials.loginUrl,
            username:    data.credentials.username,
            password:    data.credentials.password,
            email:       data.credentials.email,
            siteTitle:   data.credentials.siteTitle,
            installPath: data.credentials.installPath,
          },
        });
        toast({ title: "WordPress Reinstalled", description: "Your site has been reinstalled successfully." });
        fetchService();
      }
    } catch (e: any) {
      setWpPolling(false);
      setWpProvisionData({ status: "failed", step: null, error: e.message });
      toast({ title: "Reinstall failed", description: e.message, variant: "destructive" });
    } finally {
      setWpReinstallLoading(false);
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
          else toast({ title: "Backup failed", description: b.errorMessage || "Unknown error", variant: "destructive" });
        }
      }, 3000);
    } catch (e: any) {
      toast({ title: "Backup error", description: e.message, variant: "destructive" });
      setCreatingBackup(false);
    }
  }

  async function handleAiBuilder() {
    if (!service) return;
    setAiBuilderLoading(true);
    try {
      const res = await authFetch(`/api/client/hosting/${service.id}/ai-builder`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI Builder failed");
      if (data.alreadyInstalled && data.adminUrl) {
        window.open(data.adminUrl, "_blank");
      } else if (data.installing) {
        // WP install triggered — start polling so progress bar appears
        toast({ title: "AI Builder", description: "WordPress is being installed. This takes 1–2 minutes." });
        setWpProvisionData({ status: "queued", step: "Queued", error: null });
        setWpPolling(true);
      }
    } catch (e: any) {
      toast({ title: "AI Builder error", description: e.message, variant: "destructive" });
    } finally { setAiBuilderLoading(false); }
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
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <LayoutGrid size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">WordPress</h3>
            {wpProvisionData === null ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> Checking…
              </span>
            ) : wpProvisionData.status === "active" && !wpPolling ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                <CheckCircle2 size={11} /> Installed
              </span>
            ) : wpPolling ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> Installing…
              </span>
            ) : wpProvisionData.status === "failed" ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                Failed
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
                Not Installed
              </span>
            )}
          </div>
          {/* Login button — only shown when server confirms installed */}
          {wpProvisionData?.status === "active" && !wpPolling && (
            <a href={wpProvisionData.credentials?.loginUrl || "#"} target="_blank" rel="noreferrer">
              <Button size="sm" className="gap-1.5">
                <ExternalLink size={13} /> Login to WordPress
              </Button>
            </a>
          )}
        </div>

        {/* ─── Installing: Step-by-step progress ─── */}
        {wpPolling && wpProvisionData && wpProvisionData.status !== "active" && (
          <div className="space-y-4">
            <div className="space-y-1">
              {[
                { label: "Creating directory",    key: "mkdir" },
                { label: "Downloading WordPress", key: "download" },
                { label: "Extracting files",      key: "extract" },
                { label: "Moving files",          key: "move" },
                { label: "Creating database",     key: "database" },
                { label: "Configuring WordPress", key: "configure" },
                { label: "Setting permissions",   key: "perms" },
                { label: "Running installer",     key: "install" },
                { label: "Verifying installation",key: "verify" },
              ].map((step, idx, arr) => {
                const currentStep = wpProvisionData.step?.toLowerCase() ?? "";
                const currentIdx = arr.findIndex(s => currentStep === s.label.toLowerCase() || currentStep.startsWith(s.label.toLowerCase()));
                const isDone = currentIdx > idx;
                const isActive = currentIdx === idx;
                return (
                  <div key={step.key} className="flex items-center gap-3 py-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold border
                      ${isDone ? "bg-green-500/20 border-green-500/40 text-green-400" :
                        isActive ? "bg-primary/20 border-primary/40 text-primary" :
                          "bg-secondary border-border text-muted-foreground"}`}>
                      {isDone ? <CheckCircle2 size={14} /> : isActive ? <Loader2 size={12} className="animate-spin" /> : idx + 1}
                    </div>
                    <span className={`text-sm ${isDone ? "text-green-400" : isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                    {isActive && <span className="text-xs text-muted-foreground animate-pulse ml-auto">In progress…</span>}
                    {isDone && <span className="text-xs text-green-400 ml-auto">Done</span>}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">This takes 1–3 minutes. You can leave this page and come back — the install continues in the background.</p>
          </div>
        )}

        {/* ─── Success: credentials card ─── */}
        {(wpProvisionData?.status === "active" && wpProvisionData.credentials) && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 size={18} />
              <span className="font-medium">WordPress is ready! Save your login credentials.</span>
            </div>
            <div className="bg-secondary/50 rounded-xl p-4 space-y-3 font-mono text-sm">
              {wpProvisionData.credentials.siteTitle && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Site</span>
                  <span className="text-foreground">{wpProvisionData.credentials.siteTitle}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Admin URL</span>
                <a href={wpProvisionData.credentials.loginUrl ?? "#"} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                  {wpProvisionData.credentials.loginUrl}
                </a>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Username</span>
                <span className="text-foreground select-all">{wpProvisionData.credentials.username}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Password</span>
                {showWpCredentials ? (
                  <span className="text-foreground font-bold select-all">{wpProvisionData.credentials.password}</span>
                ) : (
                  <button onClick={() => setShowWpCredentials(true)} className="text-primary hover:underline text-xs">Reveal once</button>
                )}
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Email</span>
                <span className="text-foreground">{wpProvisionData.credentials.email}</span>
              </div>
              {wpProvisionData.credentials.installPath && wpProvisionData.credentials.installPath !== "/" && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Install Path</span>
                  <span className="text-foreground">{wpProvisionData.credentials.installPath}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <a href={wpProvisionData.credentials.loginUrl ?? "#"} target="_blank" rel="noreferrer">
                <Button className="gap-2">
                  <ExternalLink size={15} /> Open WordPress Admin
                </Button>
              </a>
              <Button
                variant="outline"
                className="gap-2 text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                onClick={() => { generateWpCredentials(); setShowReinstallConfirm(true); }}
              >
                <RefreshCw size={14} /> Reinstall WordPress
              </Button>
            </div>
          </div>
        )}

        {/* Installed (server-confirmed) but credentials not yet in state — show minimal card */}
        {wpProvisionData?.status === "active" && !wpProvisionData.credentials && !wpPolling && (
          <div className="space-y-3">
            <div className="bg-secondary/50 rounded-xl p-4 text-sm text-muted-foreground">
              WordPress is installed. Credential details were set during installation.
            </div>
            <div className="flex flex-wrap gap-3">
              <a href={service.wpUrl || "#"} target="_blank" rel="noreferrer">
                <Button className="gap-2">
                  <ExternalLink size={15} /> Open WordPress Admin
                </Button>
              </a>
              <Button
                variant="outline"
                className="gap-2 text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                onClick={() => { generateWpCredentials(); setShowReinstallConfirm(true); }}
              >
                <RefreshCw size={14} /> Reinstall WordPress
              </Button>
            </div>
          </div>
        )}

        {/* ─── Failed ─── */}
        {wpProvisionData?.status === "failed" && !wpPolling && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-red-400">
              <XCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Installation failed</p>
                {wpProvisionData.error && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono bg-red-500/10 p-2 rounded-lg">{wpProvisionData.error}</p>
                )}
              </div>
            </div>
            <Button variant="outline" onClick={() => setWpProvisionData({ status: "not_started", step: null, error: null })} className="gap-2">
              <RefreshCw size={14} /> Retry Install
            </Button>
          </div>
        )}

        {/* ─── Not installed — smart install form ─── */}
        {!wpPolling && wpProvisionData !== null &&
          wpProvisionData.status !== "active" &&
          wpProvisionData.status !== "failed" &&
          wpProvisionData.status !== "queued" &&
          wpProvisionData.status !== "provisioning" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Install WordPress on <strong className="text-foreground">{service.domain}</strong>. A database will be provisioned and WordPress installed automatically.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/70">Site Title</label>
                <Input value={wpSiteTitle} onChange={e => setWpSiteTitle(e.target.value)} placeholder="My WordPress Site" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/70">Install Path</label>
                <select
                  value={wpInstallPath}
                  onChange={e => setWpInstallPath(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="/">/ (site root)</option>
                  <option value="/blog">/blog</option>
                  <option value="/wordpress">/wordpress</option>
                  <option value="/wp">/wp</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/70">Admin Username</label>
                <Input value={wpAdminUsername} onChange={e => setWpAdminUsername(e.target.value)} placeholder="Auto-generated" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/70">Admin Password</label>
                <div className="relative">
                  <Input
                    type={showWpPassInForm ? "text" : "password"}
                    value={wpAdminPassword}
                    onChange={e => setWpAdminPassword(e.target.value)}
                    placeholder="Auto-generated"
                    className="h-9 pr-8"
                  />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowWpPassInForm(v => !v)}>
                    {showWpPassInForm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-foreground/70">Admin Email</label>
                <Input value={wpAdminEmail} onChange={e => setWpAdminEmail(e.target.value)} placeholder={`admin@${service.domain}`} className="h-9" />
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={generateWpCredentials} className="gap-1.5 text-xs">
              <RefreshCw size={12} /> Auto-generate credentials
            </Button>

            <div className="flex gap-3 flex-wrap">
              <Button onClick={handleInstallWordPress} disabled={wpLoading || wpPolling || service.status !== "active"} className="gap-2">
                {(wpLoading || wpPolling) ? <Loader2 size={15} className="animate-spin" /> : <LayoutGrid size={15} />}
                {wpLoading ? "Starting…" : wpPolling ? "Installing…" : "Install WordPress"}
              </Button>
            </div>
            {service.status !== "active" && (
              <p className="text-xs text-orange-400">Service must be active to install WordPress.</p>
            )}
          </div>
        )}

        {/* ─── Reinstall confirm dialog ─── */}
        {showReinstallConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} className="text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Reinstall WordPress?</h3>
                  <p className="text-sm text-muted-foreground mt-1">All existing WordPress files and data will be deleted and a fresh installation will run. This cannot be undone.</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/70">New Admin Username</label>
                  <Input value={wpAdminUsername} onChange={e => setWpAdminUsername(e.target.value)} placeholder="Auto-generated" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/70">New Admin Password</label>
                  <Input type="text" value={wpAdminPassword} onChange={e => setWpAdminPassword(e.target.value)} placeholder="Auto-generated" className="h-9 font-mono text-xs" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowReinstallConfirm(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleReinstallWordPress} disabled={wpReinstallLoading} className="flex-1 gap-2 bg-orange-500 hover:bg-orange-600 text-white">
                  {wpReinstallLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {wpReinstallLoading ? "Starting…" : "Reinstall"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── AI Website Builder ─── */}
      {service.status === "active" && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Wand2 size={18} className="text-violet-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">AI Website Builder</p>
              <p className="text-sm text-muted-foreground">
                {service.wpInstalled
                  ? "WordPress is installed. Click to open the admin panel and start building."
                  : "Automatically install WordPress and open the admin panel to build your site."}
              </p>
              {/* Show Softaculous Installation ID when available — useful for Softaculous management */}
              {service.wpInstalled && wpProvisionData?.credentials?.insid && (
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  Softaculous ID: {wpProvisionData.credentials.insid}
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={() => {
              // If WordPress is already installed, go directly to the admin URL.
              // status: result 1 from Softaculous → wpUrl is the /wp-admin URL.
              if (service.wpInstalled && service.wpUrl) {
                window.open(service.wpUrl, "_blank");
                return;
              }
              // Otherwise trigger the AI Builder flow (installs WP, then opens admin)
              handleAiBuilder();
            }}
            disabled={aiBuilderLoading || wpPolling}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {aiBuilderLoading ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
            {aiBuilderLoading
              ? "Launching…"
              : service.wpInstalled
                ? "Open WordPress Admin"
                : "Launch AI Website Builder"}
          </Button>
        </div>
      )}

      {/* ─── Backup System ─── */}
      {service.status === "active" && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
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
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateBackup}
              disabled={creatingBackup || service.status !== "active"}
              className="gap-1.5 shrink-0"
            >
              {creatingBackup ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {creatingBackup ? "Creating…" : "Create Backup"}
            </Button>
          </div>

          {/* Backup list */}
          {backupsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={13} className="animate-spin" /> Loading backups…
            </div>
          ) : backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No backups yet. Click "Create Backup" to create your first one.</p>
          ) : (
            <div className="space-y-2">
              {backups.slice(0, 5).map(b => (
                <div key={b.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${b.status === "completed" ? "bg-green-400" : b.status === "failed" ? "bg-red-400" : "bg-yellow-400 animate-pulse"}`} />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {b.type === "cron" ? "Scheduled" : "Manual"} backup
                        {b.sizeMb ? ` — ${b.sizeMb} MB` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={10} />
                        {format(new Date(b.createdAt), "MMM d, yyyy · HH:mm")}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${
                    b.status === "completed" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                    b.status === "failed"    ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                               "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                  }`}>
                    {b.status === "completed" ? "Done" : b.status === "failed" ? "Failed" : "Running"}
                  </span>
                </div>
              ))}
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
