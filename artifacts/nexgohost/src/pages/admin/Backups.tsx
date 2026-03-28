import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, CloudUpload, Database, FileArchive, HardDrive, Play, RefreshCw, Shield, Info, ChevronDown, ChevronUp, Copy } from "lucide-react";

const BRAND = "linear-gradient(135deg, #701AFE 0%, #9B51E0 60%, #C084FC 100%)";

const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(path, { credentials: "include", ...opts });

type BackupLog = {
  id: string;
  status: "pending" | "running" | "success" | "failed";
  triggeredBy: string;
  dbFileId: string | null;
  dbFileName: string | null;
  filesFileId: string | null;
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
  configured: boolean;
  last: BackupLog | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" });
}

function fmtSize(kb: number | null) {
  if (kb == null) return "—";
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: BackupLog["status"] }) {
  const map = {
    success: { bg: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400", icon: <CheckCircle size={12} />, label: "Success" },
    failed:  { bg: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",     icon: <XCircle size={12} />,    label: "Failed"  },
    running: { bg: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",   icon: <RefreshCw size={12} className="animate-spin" />, label: "Running" },
    pending: { bg: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400", icon: <Clock size={12} />, label: "Pending" },
  };
  const { bg, icon, label } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg}`}>
      {icon} {label}
    </span>
  );
}

function StorageBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const color = pct > 85 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{(used / 1024).toFixed(1)} GB used</span>
        <span>{(total / 1024).toFixed(1)} GB total</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{pct}% of Drive storage used</p>
    </div>
  );
}

const SETUP_INSTRUCTIONS = [
  { step: 1, title: "Create a Google Cloud Project", body: "Go to console.cloud.google.com → New Project → enable the Google Drive API." },
  { step: 2, title: "Create a Service Account", body: "IAM & Admin → Service Accounts → Create. Give it the Editor role or a custom Drive role." },
  { step: 3, title: "Download the JSON key", body: "Open the service account → Keys tab → Add Key → Create new key → JSON. Save the file." },
  { step: 4, title: "Share a Drive folder", body: "In Google Drive create a folder → share it with the service account email (e.g. noehost@project.iam.gserviceaccount.com) as Editor." },
  { step: 5, title: "Add env secret", body: "In Replit Secrets (or your .env), set GOOGLE_SERVICE_ACCOUNT_JSON to the full contents of the JSON key file. Optionally set GOOGLE_DRIVE_FOLDER_ID to the root folder ID." },
];

function SetupGuide() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyExample() {
    const sample = `{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\\n...\\n-----END RSA PRIVATE KEY-----\\n",
  "client_email": "noehost@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}`;
    navigator.clipboard.writeText(sample).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-blue-100/60 dark:hover:bg-blue-900/20 transition-colors"
      >
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-semibold text-sm">
          <Info size={16} /> How to connect Google Drive
        </div>
        {open ? <ChevronUp size={16} className="text-blue-500" /> : <ChevronDown size={16} className="text-blue-500" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          <ol className="space-y-3">
            {SETUP_INSTRUCTIONS.map(({ step, title, body }) => (
              <li key={step} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold text-white flex items-center justify-center" style={{ background: BRAND }}>
                  {step}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-lg bg-muted/60 border p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">JSON key format</p>
              <button onClick={copyExample} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Copy size={11} /> {copied ? "Copied!" : "Copy example"}
              </button>
            </div>
            <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed">
{`GOOGLE_SERVICE_ACCOUNT_JSON='{
  "type": "service_account",
  "project_id": "...",
  "private_key": "...",
  "client_email": "..."
}'`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminBackups() {
  const qc = useQueryClient();
  const [runMsg, setRunMsg] = useState("");

  const { data: status, isLoading: statusLoading } = useQuery<BackupStatus>({
    queryKey: ["admin-backup-status"],
    queryFn: () => apiFetch("/api/admin/backups/status").then(r => r.json()),
    refetchInterval: 15_000,
  });

  const { data: rawLogs, isLoading: logsLoading } = useQuery<BackupLog[]>({
    queryKey: ["admin-backup-logs"],
    queryFn: () => apiFetch("/api/admin/backups").then(r => r.json()),
    refetchInterval: 15_000,
  });
  const logs = Array.isArray(rawLogs) ? rawLogs : [];

  const runMut = useMutation({
    mutationFn: () => apiFetch("/api/admin/backups/run", { method: "POST" }).then(r => r.json()),
    onSuccess: (d: any) => {
      setRunMsg(d.message ?? d.error ?? "Backup triggered.");
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["admin-backup-status"] });
        qc.invalidateQueries({ queryKey: ["admin-backup-logs"] });
        setRunMsg("");
      }, 4000);
    },
    onError: () => setRunMsg("Request failed — please try again."),
  });

  const last = status?.last;
  const configured = status?.configured ?? false;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup &amp; Drive</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nightly automated backups to Google Drive at <strong>3:00 AM PKT</strong> with 30-day retention.
          </p>
        </div>
        <button
          onClick={() => runMut.mutate()}
          disabled={runMut.isPending || !configured}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-sm disabled:opacity-50 transition-opacity"
          style={{ background: BRAND }}
        >
          {runMut.isPending ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
          Run Now
        </button>
      </div>

      {runMsg && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          {runMsg}
        </div>
      )}

      {/* ── Status Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Drive Connection */}
        <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <Shield size={15} /> Connection
          </div>
          {statusLoading ? (
            <div className="h-6 w-24 bg-muted animate-pulse rounded" />
          ) : configured ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle size={18} /> Connected
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-500 font-semibold">
              <XCircle size={18} /> Not configured
            </div>
          )}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {configured ? "Service account key loaded. Drive is ready." : "Add GOOGLE_SERVICE_ACCOUNT_JSON to environment secrets."}
          </p>
        </div>

        {/* Last Backup */}
        <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <CloudUpload size={15} /> Last Backup
          </div>
          {statusLoading ? (
            <div className="h-6 w-28 bg-muted animate-pulse rounded" />
          ) : last ? (
            <>
              <StatusBadge status={last.status} />
              <p className="text-xs text-muted-foreground">{fmtDate(last.startedAt)}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No backups yet</p>
          )}
        </div>

        {/* Drive Storage */}
        <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <HardDrive size={15} /> Drive Storage
          </div>
          {last?.driveUsedMb && last?.driveTotalMb ? (
            <StorageBar used={last.driveUsedMb} total={last.driveTotalMb} />
          ) : (
            <p className="text-sm text-muted-foreground">Shown after first backup</p>
          )}
        </div>
      </div>

      {/* ── Last Backup Detail ── */}
      {last && last.status === "success" && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-sm">Last Successful Backup</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
              <Database size={18} className="text-violet-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">Database Dump</p>
                <p className="text-sm font-medium truncate">{last.dbFileName ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{fmtSize(last.dbSizeKb)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
              <FileArchive size={18} className="text-violet-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">Files Archive</p>
                <p className="text-sm font-medium truncate">{last.filesFileName ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{fmtSize(last.filesSizeKb)}</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Completed: {fmtDate(last.completedAt)} · Triggered by: {last.triggeredBy}
          </p>
        </div>
      )}

      {/* ── Setup Guide (only if not configured) ── */}
      {!configured && !statusLoading && <SetupGuide />}

      {/* ── Backup History ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm">Backup History</h2>
          <button
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["admin-backup-logs"] });
              qc.invalidateQueries({ queryKey: ["admin-backup-status"] });
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {logsLoading ? (
          <div className="p-8 flex justify-center">
            <RefreshCw className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <CloudUpload size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No backups have run yet.</p>
            <p className="text-xs mt-1">The first nightly backup runs at 3:00 AM PKT, or click <strong>Run Now</strong> above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Started (PKT)</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Trigger</th>
                  <th className="px-5 py-3 text-right">DB Size</th>
                  <th className="px-5 py-3 text-right">Files Size</th>
                  <th className="px-5 py-3 text-left">Error</th>
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
                        <span className="text-red-500 text-xs truncate block">{log.errorMessage}</span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Retention Policy ── */}
      <div className="rounded-xl border bg-muted/20 px-5 py-4 flex items-start gap-3">
        <Shield size={16} className="text-violet-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold">30-Day Retention Policy</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Backups older than 30 days are automatically removed from Google Drive after each run to manage storage usage.
            Local temp files are deleted immediately after each upload.
          </p>
        </div>
      </div>

    </div>
  );
}
