import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle, XCircle, Clock, CloudUpload, Database, FileArchive,
  HardDrive, Play, RefreshCw, Shield, Info, ChevronDown, ChevronUp,
  LogOut, AlertTriangle, ShieldCheck,
} from "lucide-react";

const BRAND = "linear-gradient(135deg, #701AFE 0%, #9B51E0 60%, #C084FC 100%)";
const GOOGLE_BLUE = "#4285F4";

const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(path, { credentials: "include", ...opts });

type BackupLog = {
  id: string;
  status: "pending" | "running" | "success" | "failed";
  triggeredBy: string;
  dbFileName: string | null;
  filesFileName: string | null;
  dbSizeKb: number | null;
  filesSizeKb: number | null;
  driveUsedMb: number | null;
  driveTotalMb: number | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

type BackupStatus = {
  connected: boolean;
  email: string | null;
  autoEnabled: boolean;
  last: BackupLog | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fmtLastSync(iso: string | null, status: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  // Compare calendar dates in PKT (UTC+5)
  const pktOffset = 5 * 60 * 60_000;
  const dPkt = new Date(d.getTime() + pktOffset);
  const nowPkt = new Date(now.getTime() + pktOffset);
  const dDate = dPkt.toISOString().slice(0, 10);
  const todayDate = nowPkt.toISOString().slice(0, 10);
  const yesterdayDate = new Date(nowPkt.getTime() - 86_400_000).toISOString().slice(0, 10);
  const timeStr = dPkt.toISOString().slice(11, 16).replace(":", ":"); // "03:00"
  const label = dDate === todayDate ? "Today" : dDate === yesterdayDate ? "Yesterday" : fmtDate(iso).split(",")[0];
  const statusLabel = status === "success" ? "✓ Success" : status === "failed" ? "✗ Failed" : status;
  return `${label} ${timeStr} PKT (${statusLabel})`;
}

function fmtSize(kb: number | null) {
  if (kb == null) return "—";
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: BackupLog["status"] }) {
  const map = {
    success: { cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400", icon: <CheckCircle size={12} />, label: "Success" },
    failed:  { cls: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",                icon: <XCircle size={12} />,    label: "Failed"  },
    running: { cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",            icon: <RefreshCw size={12} className="animate-spin" />, label: "Running" },
    pending: { cls: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",    icon: <Clock size={12} />,      label: "Pending" },
  };
  const { cls, icon, label } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {icon} {label}
    </span>
  );
}

function StorageBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const color = pct > 85 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-emerald-500";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground font-medium">
        <span>{(used / 1024).toFixed(1)} GB used</span>
        <span>{(total / 1024).toFixed(1)} GB total</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{pct}% of Google Drive used</p>
    </div>
  );
}

function Toggle({ enabled, onToggle, loading }: { enabled: boolean; onToggle: () => void; loading: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none disabled:opacity-50 ${enabled ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${enabled ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

function GoogleConnectButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-5 py-3 rounded-xl border-2 border-[#4285F4] bg-white dark:bg-[#1a1a2e] hover:bg-[#4285F4]/5 dark:hover:bg-[#4285F4]/10 transition-colors shadow-sm font-semibold text-sm text-[#4285F4]"
    >
      {/* Google "G" logo */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Connect Google Drive for Backups
    </button>
  );
}

function SetupGuide({ callbackUrl }: { callbackUrl: string }) {
  const [open, setOpen] = useState(false);

  const steps = [
    {
      n: 1,
      title: "Google Cloud Console → Enable Drive API",
      body: "Go to console.cloud.google.com → Select or create a project → APIs & Services → Enable APIs → search 'Google Drive API' and enable it.",
    },
    {
      n: 2,
      title: "Configure OAuth Consent Screen",
      body: "APIs & Services → OAuth consent screen → External → fill in app name (e.g. 'Noehost Backup') and support email → add scope: drive.",
    },
    {
      n: 3,
      title: "Create OAuth 2.0 Client ID",
      body: "APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID → Web application → add the Authorized redirect URI below.",
    },
    {
      n: 4,
      title: "Add the Authorized Redirect URI",
      body: callbackUrl,
      isCode: true,
    },
    {
      n: 5,
      title: "Save Client ID & Secret in Settings",
      body: "Copy the Client ID and Client Secret → go to Admin → Settings → scroll to Google OAuth → paste them and save.",
    },
    {
      n: 6,
      title: "Click 'Connect Google Drive' above",
      body: "Once credentials are saved, click the button above and sign in with the Google account whose Drive you want to use.",
    },
  ];

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors"
      >
        <span className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-semibold text-sm">
          <Info size={15} /> How to set up Google Drive connection
        </span>
        {open ? <ChevronUp size={15} className="text-blue-400" /> : <ChevronDown size={15} className="text-blue-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3">
          <ol className="space-y-3">
            {steps.map(s => (
              <li key={s.n} className="flex gap-3">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold text-white flex items-center justify-center mt-0.5"
                  style={{ background: BRAND }}
                >
                  {s.n}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  {s.isCode ? (
                    <code className="block mt-1 text-xs bg-muted border rounded px-3 py-2 break-all font-mono text-primary">
                      {s.body}
                    </code>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.body}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function AdminBackups() {
  const qc = useQueryClient();
  const [runMsg, setRunMsg] = useState("");
  const [runError, setRunError] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("");

  // Pick up OAuth callback query params on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("drive_connected");
    const driveError = params.get("drive_error");
    const email = params.get("email");
    if (connected) {
      setRunMsg(`Google Drive connected successfully${email ? ` as ${decodeURIComponent(email)}` : ""}!`);
      setRunError(false);
      qc.invalidateQueries({ queryKey: ["admin-backup-status"] });
      window.history.replaceState({}, "", "/admin/backups");
    } else if (driveError) {
      setRunMsg(`Connection failed: ${decodeURIComponent(driveError)}`);
      setRunError(true);
      window.history.replaceState({}, "", "/admin/backups");
    }
  }, []);

  const { data: status, isLoading: statusLoading } = useQuery<BackupStatus>({
    queryKey: ["admin-backup-status"],
    queryFn: () => apiFetch("/api/admin/backups/status").then(r => r.json()),
    refetchInterval: 12_000,
  });

  const { data: rawLogs, isLoading: logsLoading } = useQuery<BackupLog[]>({
    queryKey: ["admin-backup-logs"],
    queryFn: () => apiFetch("/api/admin/backups").then(r => r.json()),
    refetchInterval: 12_000,
  });
  const logs = Array.isArray(rawLogs) ? rawLogs : [];

  const connectMut = useMutation({
    mutationFn: () => apiFetch("/api/admin/backups/google/auth-url").then(r => r.json()),
    onSuccess: (d: any) => {
      if (d.url) {
        if (d.callbackUrl) setCallbackUrl(d.callbackUrl);
        window.location.href = d.url;
      } else {
        setRunMsg(d.error || "Failed to get auth URL.");
        setRunError(true);
      }
    },
    onError: () => { setRunMsg("Could not reach server. Please try again."); setRunError(true); },
  });

  const disconnectMut = useMutation({
    mutationFn: () => apiFetch("/api/admin/backups/google/disconnect", { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-backup-status"] });
      setRunMsg("Google Drive disconnected."); setRunError(false);
    },
  });

  const toggleMut = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch("/api/admin/backups/toggle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-backup-status"] }),
  });

  const runMut = useMutation({
    mutationFn: () => apiFetch("/api/admin/backups/run", { method: "POST" }).then(r => r.json()),
    onSuccess: (d: any) => {
      setRunMsg(d.message ?? d.error ?? "Backup triggered.");
      setRunError(!!d.error);
      if (!d.error) setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["admin-backup-status"] });
        qc.invalidateQueries({ queryKey: ["admin-backup-logs"] });
      }, 3000);
    },
    onError: () => { setRunMsg("Request failed."); setRunError(true); },
  });

  const connected = status?.connected ?? false;
  const autoEnabled = status?.autoEnabled ?? true;
  const last = status?.last;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-7">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup &amp; Drive</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Full nightly backups to your Google Drive at <strong>3:00 AM PKT</strong>. Non-destructive, timestamped, verified.
          </p>
        </div>
        {connected && (
          <button
            onClick={() => runMut.mutate()}
            disabled={runMut.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-sm disabled:opacity-50 whitespace-nowrap"
            style={{ background: BRAND }}
          >
            {runMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            Sync Now
          </button>
        )}
      </div>

      {/* ── Toast / feedback ── */}
      {runMsg && (
        <div className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${runError ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400" : "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"}`}>
          {runError ? <XCircle size={16} /> : <CheckCircle size={16} />}
          {runMsg}
          <button className="ml-auto text-current opacity-60 hover:opacity-100" onClick={() => setRunMsg("")}>✕</button>
        </div>
      )}

      {/* ── Connection Card ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BRAND }}>
            <CloudUpload size={16} className="text-white" />
          </div>
          <h2 className="font-semibold">Google Drive Connection</h2>
        </div>

        <div className="p-5 space-y-5">
          {statusLoading ? (
            <div className="h-12 bg-muted animate-pulse rounded-lg" />
          ) : connected ? (
            /* ── Connected state ── */
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                  <p className="font-semibold text-foreground">
                    Connected to <span className="text-emerald-600 dark:text-emerald-400">{status?.email ?? "—"}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-medium text-foreground">Automatic Daily Backups</span>
                  <Toggle
                    enabled={autoEnabled}
                    loading={toggleMut.isPending}
                    onToggle={() => toggleMut.mutate(!autoEnabled)}
                  />
                  <span className={`text-sm font-semibold ${autoEnabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    {autoEnabled ? "ON" : "OFF"}
                  </span>
                </div>
                <button
                  onClick={() => { if (confirm("Disconnect Google Drive? Existing backups on Drive are kept.")) disconnectMut.mutate(); }}
                  disabled={disconnectMut.isPending}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  <LogOut size={14} /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            /* ── Not connected state ── */
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <XCircle size={18} className="text-red-400" />
                <p className="text-sm">No Google account connected yet.</p>
              </div>
              <GoogleConnectButton onClick={() => connectMut.mutate()} />
              {connectMut.isPending && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <RefreshCw size={12} className="animate-spin" /> Redirecting to Google…
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Setup Guide (only when not connected) ── */}
      {!connected && !statusLoading && (
        <SetupGuide callbackUrl={callbackUrl || `${window.location.origin}/api/admin/backups/google/callback`} />
      )}

      {/* ── Stats Row (when connected) ── */}
      {connected && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Last Sync */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <CloudUpload size={13} /> Last Sync
            </p>
            {statusLoading ? <div className="h-5 w-32 bg-muted animate-pulse rounded" /> : last ? (
              <>
                <StatusBadge status={last.status} />
                <p className="text-xs font-medium text-foreground/80 leading-relaxed">
                  {fmtLastSync(last.startedAt, last.status)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No syncs yet</p>
            )}
          </div>

          {/* Drive Storage */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <HardDrive size={13} /> Drive Storage
            </p>
            {last?.driveUsedMb && last?.driveTotalMb ? (
              <StorageBar used={last.driveUsedMb} total={last.driveTotalMb} />
            ) : (
              <p className="text-sm text-muted-foreground">Available after first backup</p>
            )}
          </div>

          {/* Integrity */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck size={13} /> Integrity Check
            </p>
            {last?.status === "success" ? (
              last.errorMessage?.startsWith("WARNING") ? (
                <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400 font-semibold text-sm">
                  <AlertTriangle size={16} /> Size mismatch
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  <CheckCircle size={16} /> Verified OK
                </div>
              )
            ) : (
              <p className="text-sm text-muted-foreground">Shown after backup</p>
            )}
          </div>
        </div>
      )}

      {/* ── Last Backup Detail ── */}
      {last && last.status === "success" && !last.errorMessage?.startsWith("WARNING") && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <ShieldCheck size={15} className="text-emerald-500" /> Latest Verified Backup
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-muted/40 border">
              <Database size={18} className="text-violet-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground mb-0.5">Database Dump</p>
                <p className="text-sm font-medium truncate">{last.dbFileName ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{fmtSize(last.dbSizeKb)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-muted/40 border">
              <FileArchive size={18} className="text-violet-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground mb-0.5">Full Files Archive</p>
                <p className="text-sm font-medium truncate">{last.filesFileName ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{fmtSize(last.filesSizeKb)}</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Completed: {fmtDate(last.completedAt)} · Trigger: {last.triggeredBy}
          </p>
        </div>
      )}

      {/* ── Backup History ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm">Backup History</h2>
          <button
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["admin-backup-logs"] });
              qc.invalidateQueries({ queryKey: ["admin-backup-status"] });
            }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {logsLoading ? (
          <div className="p-8 flex justify-center"><RefreshCw className="animate-spin text-muted-foreground" size={22} /></div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <CloudUpload size={36} className="mx-auto mb-3 opacity-25" />
            <p className="text-sm font-medium">No backups yet</p>
            <p className="text-xs mt-1 max-w-xs mx-auto">
              {connected
                ? "The first nightly backup runs at 3:00 AM PKT, or click Sync Now above."
                : "Connect Google Drive first to enable automatic backups."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Date &amp; Time (PKT)</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Trigger</th>
                  <th className="px-5 py-3 text-right">DB Size</th>
                  <th className="px-5 py-3 text-right">Files Size</th>
                  <th className="px-5 py-3 text-left">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-foreground/80">{fmtDate(log.startedAt)}</td>
                    <td className="px-5 py-3"><StatusBadge status={log.status} /></td>
                    <td className="px-5 py-3 capitalize text-foreground/70">{log.triggeredBy}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground/70">{fmtSize(log.dbSizeKb)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground/70">{fmtSize(log.filesSizeKb)}</td>
                    <td className="px-5 py-3 max-w-xs">
                      {log.errorMessage ? (
                        <span className={`text-xs truncate block ${log.errorMessage.startsWith("WARNING") ? "text-yellow-600 dark:text-yellow-400" : "text-red-500"}`}>
                          {log.errorMessage}
                        </span>
                      ) : log.status === "success" ? (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <ShieldCheck size={11} /> Verified
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Safety Notice ── */}
      <div className="rounded-xl border bg-muted/20 px-5 py-4 flex items-start gap-3">
        <Shield size={16} className="text-violet-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold">Zero-Risk Backup Policy</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Backups use PostgreSQL's MVCC — <strong>zero table locks</strong>, no downtime, live clients can buy domains and pay invoices during any backup run.
            Every file gets a unique ISO date name (e.g. <em>Noehost_Full_Backup_2026-03-28.zip</em>) stored in
            <strong> Noehost_Cloud_Backups/Full_Databases/</strong> and <strong>Full_Files/</strong>.
            Old backups are <strong>never auto-deleted</strong> — your entire history stays on Drive.
            File size is verified against Drive after every upload to confirm a complete, uncorrupted transfer.
          </p>
        </div>
      </div>

    </div>
  );
}
