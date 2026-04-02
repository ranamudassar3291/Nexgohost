import { useState, useEffect, useCallback } from "react";
import { useGetMe } from "@workspace/api-client-react";
import {
  ArrowRightLeft, Database, Lock, Globe, Server, CheckCircle2,
  AlertTriangle, Loader2, RefreshCw, ExternalLink, Clock, XCircle,
  ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Migration {
  id: string;
  domain: string;
  oldHostingProvider: string | null;
  oldCpanelHost: string;
  oldCpanelUsername: string;
  sourceType: "cpanel" | "whm";
  whmAccount: string | null;
  twentyiJobId: string | null;
  twentyiSiteId: string | null;
  status: "pending" | "in_progress" | "completed" | "failed";
  progress: number;
  notes: string | null;
  requestedAt: string;
  completedAt: string | null;
}

interface WhmAccount {
  user: string;
  domain: string;
  email: string;
  diskUsed: string;
  plan: string;
}

function StatusBadge({ status }: { status: Migration["status"] }) {
  const map = {
    pending:     { label: "Pending",     cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
    in_progress: { label: "In Progress", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    completed:   { label: "Completed",   cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    failed:      { label: "Failed",      cls: "bg-red-500/10 text-red-600 border-red-500/20" },
  };
  const cfg = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {status === "in_progress" && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
      {cfg.label}
    </span>
  );
}

function MigrationCard({ migration, onStackCP }: { migration: Migration; onStackCP: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = {
    pending: "bg-yellow-500",
    in_progress: "bg-blue-500",
    completed: "bg-emerald-500",
    failed: "bg-red-500",
  }[migration.status] ?? "bg-muted";

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              {migration.status === "completed"
                ? <CheckCircle2 size={22} className="text-emerald-500" />
                : migration.status === "failed"
                ? <XCircle size={22} className="text-red-500" />
                : migration.status === "in_progress"
                ? <Loader2 size={22} className="text-blue-500 animate-spin" />
                : <Clock size={22} className="text-yellow-500" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-foreground text-base">{migration.domain}</h4>
                <StatusBadge status={migration.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                From: <span className="font-medium">{migration.oldHostingProvider || migration.oldCpanelHost}</span>
                {migration.sourceType === "whm" && migration.whmAccount && (
                  <span> &mdash; cPanel: <span className="font-medium">{migration.whmAccount}</span></span>
                )}
                <span className="mx-1">·</span>
                {format(new Date(migration.requestedAt), "MMM d, yyyy")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {migration.status === "completed" && migration.twentyiSiteId && (
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                onClick={() => onStackCP(migration.id)}
              >
                <ExternalLink size={13} /> StackCP Login
              </Button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground transition-colors"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1.5 font-medium">
            <span className="uppercase text-muted-foreground tracking-wide">{migration.status.replace("_", " ")}</span>
            <span className={migration.status === "completed" ? "text-emerald-600" : "text-primary"}>{migration.progress}%</span>
          </div>
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${statusColor}`}
              style={{ width: `${migration.progress}%` }}
            />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/50 px-5 py-4 bg-secondary/20 space-y-2 text-xs text-muted-foreground">
          <p><span className="font-semibold text-foreground/70">Source Host:</span> {migration.oldCpanelHost}</p>
          <p><span className="font-semibold text-foreground/70">Source Username:</span> {migration.oldCpanelUsername}</p>
          {migration.twentyiSiteId && <p><span className="font-semibold text-foreground/70">20i Site ID:</span> {migration.twentyiSiteId}</p>}
          {migration.notes && (
            <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
              <Info size={12} className="inline mr-1.5" />
              {migration.notes}
            </div>
          )}
          {migration.completedAt && <p><span className="font-semibold text-foreground/70">Completed:</span> {format(new Date(migration.completedAt), "MMM d, yyyy HH:mm")}</p>}
        </div>
      )}
    </div>
  );
}

export default function ClientMigrations() {
  const { data: me } = useGetMe();
  const { toast } = useToast();

  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [sourceType, setSourceType] = useState<"cpanel" | "whm">("cpanel");
  const [form, setForm] = useState({
    domain: "",
    oldHostingProvider: "",
    host: "",
    username: "",
    password: "",
    notes: "",
  });

  // WHM account selection
  const [whmLoading, setWhmLoading] = useState(false);
  const [whmAccounts, setWhmAccounts] = useState<WhmAccount[]>([]);
  const [whmFetched, setWhmFetched] = useState(false);
  const [selectedWhmAccount, setSelectedWhmAccount] = useState<WhmAccount | null>(null);

  const token = localStorage.getItem("token");

  const fetchMigrations = useCallback(async () => {
    try {
      const res = await fetch("/api/migrations", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMigrations(await res.json());
    } catch {
      // silent
    } finally {
      setLoadingList(false);
    }
  }, [token]);

  useEffect(() => { fetchMigrations(); }, [fetchMigrations]);

  // Real-time polling for in_progress migrations
  useEffect(() => {
    const active = migrations.filter(m => m.status === "in_progress" || m.status === "pending");
    if (active.length === 0) return;

    const interval = setInterval(async () => {
      for (const m of active) {
        try {
          const res = await fetch(`/api/migrations/${m.id}/status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const { migration: updated } = await res.json();
            setMigrations(prev => prev.map(p => p.id === updated.id ? updated : p));
          }
        } catch {
          // silent
        }
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [migrations, token]);

  const handleFetchWhmAccounts = async () => {
    if (!form.host || !form.username || !form.password) {
      toast({ title: "Enter WHM credentials first", description: "Fill host, username, and password above.", variant: "destructive" });
      return;
    }
    setWhmLoading(true);
    setWhmAccounts([]);
    setWhmFetched(false);
    setSelectedWhmAccount(null);
    try {
      const params = new URLSearchParams({ host: form.host, user: form.username, password: form.password });
      const res = await fetch(`/api/migrations/whm-accounts?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch WHM accounts");
      setWhmAccounts(data.accounts ?? []);
      setWhmFetched(true);
      if ((data.accounts ?? []).length === 0) {
        toast({ title: "No accounts found", description: "WHM returned an empty account list." });
      }
    } catch (err: any) {
      toast({ title: "WHM Connection Failed", description: err.message, variant: "destructive" });
    } finally {
      setWhmLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceType === "whm" && !selectedWhmAccount) {
      toast({ title: "Select a cPanel account", description: "Choose an account from the list below.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        domain: sourceType === "whm" ? (selectedWhmAccount!.domain || form.domain) : form.domain,
        sourceType,
        host: form.host,
        username: form.username,
        password: form.password,
        oldHostingProvider: form.oldHostingProvider || form.host,
        notes: form.notes || undefined,
      };
      if (sourceType === "whm" && selectedWhmAccount) {
        body.whmAccount = selectedWhmAccount.user;
        if (!form.domain) body.domain = selectedWhmAccount.domain;
      }

      const res = await fetch("/api/migrations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start migration");

      setMigrations(prev => [data, ...prev]);
      setShowForm(false);
      setForm({ domain: "", oldHostingProvider: "", host: "", username: "", password: "", notes: "" });
      setWhmAccounts([]);
      setWhmFetched(false);
      setSelectedWhmAccount(null);
      toast({ title: "Migration Started!", description: `We're migrating ${data.domain} to 20i hosting.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStackCP = async (migrationId: string) => {
    try {
      const res = await fetch(`/api/migrations/${migrationId}/stackcp-url`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not get StackCP URL");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast({ title: "StackCP Error", description: err.message, variant: "destructive" });
    }
  };

  // If user can't migrate, show a locked state
  if (me && !(me as any).canMigrate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
          <Lock size={28} className="text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground">Migration Access Required</h2>
        <p className="text-muted-foreground max-w-md">
          Website migrations are a premium feature. Please contact our support team to enable migration access for your account.
        </p>
        <Button onClick={() => window.location.href = "/client/tickets"} className="bg-primary hover:bg-primary/90">
          Contact Support
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Website Migrations</h2>
          <p className="text-muted-foreground mt-1">Move your existing sites to 20i hosting — free.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchMigrations} className="gap-1.5">
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-sm"
          >
            <ArrowRightLeft size={16} /> Start Migration
          </Button>
        </div>
      </div>

      {/* Migration Form */}
      {showForm && (
        <div className="bg-card border border-primary/20 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-[50px] pointer-events-none" />
          <h3 className="text-xl font-bold mb-1 font-display">New Migration Request</h3>
          <p className="text-sm text-muted-foreground mb-6">Provide your current hosting details — we'll handle the rest.</p>

          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            {/* Source type toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Source Type</label>
              <div className="flex gap-2">
                {[
                  { value: "cpanel", label: "cPanel Account", icon: Database },
                  { value: "whm",    label: "WHM Server",     icon: Server },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setSourceType(value as "cpanel" | "whm"); setWhmAccounts([]); setWhmFetched(false); setSelectedWhmAccount(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                      sourceType === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {sourceType === "cpanel" && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><Globe size={13}/> Domain to Migrate</label>
                <Input
                  required
                  placeholder="example.com"
                  value={form.domain}
                  onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                  className="bg-background"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2"><Server size={13}/> Current Provider / Label</label>
              <Input
                placeholder="e.g. GoDaddy, HostGator, My Server"
                value={form.oldHostingProvider}
                onChange={e => setForm(f => ({ ...f, oldHostingProvider: e.target.value }))}
                className="bg-background"
              />
            </div>

            {/* Credentials */}
            <div className="p-5 bg-secondary/30 rounded-xl border border-border/50 space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                <Lock size={14} />
                {sourceType === "whm" ? "WHM Root Credentials" : "cPanel Credentials"}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Host / IP</label>
                  <Input
                    required
                    placeholder={sourceType === "whm" ? "server.example.com" : "192.168.1.1"}
                    value={form.host}
                    onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
                    className="bg-background h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">{sourceType === "whm" ? "WHM Username" : "cPanel Username"}</label>
                  <Input
                    required
                    placeholder={sourceType === "whm" ? "root" : "cpanel_user"}
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    className="bg-background h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium flex items-center gap-1"><Lock size={11}/> Password / API Token</label>
                  <Input
                    type="password"
                    required
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="bg-background h-10"
                  />
                </div>
              </div>

              {/* WHM: fetch accounts button */}
              {sourceType === "whm" && (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFetchWhmAccounts}
                    disabled={whmLoading}
                    className="gap-2"
                  >
                    {whmLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {whmLoading ? "Fetching accounts..." : "Fetch WHM Accounts"}
                  </Button>
                </div>
              )}
            </div>

            {/* WHM Account Selector */}
            {sourceType === "whm" && whmFetched && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Database size={14} /> Select cPanel Account to Migrate
                  <span className="text-muted-foreground font-normal">({whmAccounts.length} found)</span>
                </label>
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {whmAccounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded-xl">No accounts found on this WHM server.</p>
                  ) : (
                    whmAccounts.map(acc => (
                      <button
                        key={acc.user}
                        type="button"
                        onClick={() => {
                          setSelectedWhmAccount(acc);
                          setForm(f => ({ ...f, domain: acc.domain }));
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm text-left transition-all ${
                          selectedWhmAccount?.user === acc.user
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-secondary/50 text-foreground"
                        }`}
                      >
                        <span>
                          <span className="font-semibold">{acc.user}</span>
                          <span className="mx-1.5 text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{acc.domain}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{acc.plan}</span>
                      </button>
                    ))
                  )}
                </div>
                {selectedWhmAccount && (
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm">
                    <span className="font-medium text-primary">Selected:</span> <span className="font-semibold">{selectedWhmAccount.user}</span> — {selectedWhmAccount.domain}
                  </div>
                )}
              </div>
            )}

            {/* Domain for WHM flow */}
            {sourceType === "whm" && selectedWhmAccount && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><Globe size={13}/> Domain to Migrate</label>
                <Input
                  required
                  placeholder="example.com"
                  value={form.domain}
                  onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                  className="bg-background"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Input
                placeholder="Anything we should know about this migration?"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="bg-background"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-primary text-white gap-2"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <ArrowRightLeft size={15} />}
                {submitting ? "Starting..." : "Start Migration"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Migrations List */}
      <div className="space-y-3">
        {loadingList ? (
          <div className="p-12 text-center">
            <Loader2 size={32} className="mx-auto animate-spin text-primary opacity-50" />
          </div>
        ) : migrations.length === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-3xl p-12 text-center shadow-sm">
            <ArrowRightLeft className="w-12 h-12 mx-auto text-muted-foreground opacity-25 mb-4" />
            <p className="font-semibold text-foreground mb-1">No Migrations Yet</p>
            <p className="text-sm text-muted-foreground">Start your first migration to move your website to our 20i-powered hosting.</p>
          </div>
        ) : (
          <>
            {migrations.filter(m => m.status === "in_progress" || m.status === "pending").length > 0 && (
              <div className="flex items-center gap-2 px-1 py-2 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900">
                <Loader2 size={12} className="animate-spin shrink-0 ml-1" />
                <span>Active migrations are being tracked in real-time — this page auto-refreshes every 8 seconds.</span>
              </div>
            )}
            {migrations.map(m => (
              <MigrationCard key={m.id} migration={m} onStackCP={handleStackCP} />
            ))}
          </>
        )}
      </div>

      {/* Info box */}
      <div className="flex gap-3 p-4 rounded-xl bg-secondary/40 border border-border/50 text-xs text-muted-foreground">
        <Info size={14} className="shrink-0 mt-0.5" />
        <span>
          Your credentials are used only to initiate the migration and are not stored after the transfer is complete.
          Migrations are handled by 20i and typically take 30 minutes to 4 hours depending on website size.
        </span>
      </div>
    </div>
  );
}
