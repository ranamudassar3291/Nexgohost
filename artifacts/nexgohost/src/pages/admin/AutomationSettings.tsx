import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  FileText, Ban, Trash2, RefreshCw, Bell, Mail, Globe,
  Server, HardDrive, Play, PlayCircle, CheckCircle2,
  XCircle, AlertTriangle, Clock, Zap, Activity, ExternalLink,
  BookOpen, Search, ShieldAlert, ArrowRight, DollarSign, Timer,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const BRAND = "#701AFE";

interface TaskStat {
  task: string;
  totalRuns: number;
  successes: number;
  failures: number;
  skipped: number;
  lastRun: string | null;
  lastStatus: "success" | "failed" | "skipped" | "unknown";
  lastMessage: string | null;
}

interface AutomationStats {
  lastCronRun: string | null;
  activeTasks: number;
  stats: TaskStat[];
}

interface CronLog {
  id: string;
  task: string;
  status: "success" | "failed" | "skipped";
  message: string | null;
  executedAt: string;
}

interface PendingTermination {
  id: string;
  planName: string;
  domain: string | null;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  overdueInvoiceId: string | null;
  overdueAmount: number;
  dueDate: string | null;
  flaggedAt: string | null;
}

const TASK_META: Record<string, {
  name: string;
  description: string;
  schedule: string;
  icon: React.ElementType;
  color: string;
  category: string;
  safetyNote?: string;
}> = {
  "billing:invoice_generation": {
    name: "Invoice Generation",
    description: "Auto-generates renewal invoices 14 days before service due date and emails clients.",
    schedule: "Every 5 min",
    icon: FileText,
    color: "blue",
    category: "Billing",
  },
  "billing:mark_overdue": {
    name: "Mark Overdue",
    description: "Marks unpaid invoices as 'Overdue' immediately when the due date passes.",
    schedule: "Every 5 min",
    icon: DollarSign,
    color: "yellow",
    category: "Billing",
  },
  "billing:auto_suspend": {
    name: "Auto-Suspension",
    description: "Suspends hosting accounts with invoices 3+ days overdue and revokes hosting access.",
    schedule: "Every 5 min",
    icon: Ban,
    color: "orange",
    category: "Billing",
  },
  "billing:auto_terminate": {
    name: "Termination Flagging",
    description: "Sends warning at 15 days overdue. At 30 days, flags for pending termination — NO auto-delete.",
    schedule: "Every 5 min",
    icon: Trash2,
    color: "red",
    category: "Billing",
    safetyNote: "Manual admin approval required",
  },
  "billing:auto_unsuspend": {
    name: "Auto-Unsuspend",
    description: "Instantly reactivates suspended services as soon as a payment is verified and marked paid.",
    schedule: "Every 5 min",
    icon: RefreshCw,
    color: "green",
    category: "Billing",
  },
  "emails:hosting_renewal_reminder": {
    name: "Renewal Reminders",
    description: "Sends hosting renewal reminder emails 7 days before the service due date.",
    schedule: "Every 5 min",
    icon: Bell,
    color: "purple",
    category: "Email",
  },
  "emails:invoice_reminders": {
    name: "Invoice Reminders",
    description: "Sends payment reminders at 7d, 3d, 0d before due and 1d, 3d after overdue.",
    schedule: "Every 5 min",
    icon: Mail,
    color: "indigo",
    category: "Email",
  },
  "domains:renewal_check": {
    name: "Domain Renewal Check",
    description: "Auto-renews enabled domains and sends reminders 15 days before expiry.",
    schedule: "Every 5 min",
    icon: Globe,
    color: "teal",
    category: "Domains",
  },
  "vps:power_off_overdue": {
    name: "VPS Power Off",
    description: "Powers off VPS services whose invoices are 7+ days overdue.",
    schedule: "Every 5 min",
    icon: Server,
    color: "orange",
    category: "VPS",
  },
  "backup:daily": {
    name: "Daily Backup",
    description: "Creates automated daily backups of all active WordPress service databases and files.",
    schedule: "Every 5 min",
    icon: HardDrive,
    color: "slate",
    category: "System",
  },
};

const ALL_TASKS = Object.keys(TASK_META);

const colorMap: Record<string, string> = {
  blue:   "bg-blue-50 text-blue-600 border-blue-100",
  yellow: "bg-yellow-50 text-yellow-600 border-yellow-100",
  orange: "bg-orange-50 text-orange-600 border-orange-100",
  red:    "bg-red-50 text-red-600 border-red-100",
  green:  "bg-green-50 text-green-600 border-green-100",
  purple: "bg-purple-50 text-purple-600 border-purple-100",
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  teal:   "bg-teal-50 text-teal-600 border-teal-100",
  slate:  "bg-slate-50 text-slate-600 border-slate-100",
};

function StatusBadge({ status }: { status: TaskStat["lastStatus"] }) {
  if (status === "success") return (
    <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 text-xs">
      <CheckCircle2 size={10} /> Success
    </Badge>
  );
  if (status === "failed") return (
    <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 text-xs">
      <XCircle size={10} /> Failed
    </Badge>
  );
  if (status === "skipped") return (
    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 gap-1 text-xs">
      <AlertTriangle size={10} /> Skipped
    </Badge>
  );
  return (
    <Badge className="bg-muted text-muted-foreground gap-1 text-xs">
      <Clock size={10} /> Never Run
    </Badge>
  );
}

function TaskCard({ taskKey, stat, onRun, running }: {
  taskKey: string;
  stat?: TaskStat;
  onRun: (task: string) => void;
  running: string | null;
}) {
  const meta = TASK_META[taskKey];
  if (!meta) return null;
  const Icon = meta.icon;
  const iconClass = colorMap[meta.color] || colorMap.slate;
  const successRate = stat && stat.totalRuns > 0
    ? Math.round((stat.successes / stat.totalRuns) * 100)
    : null;

  return (
    <Card className="border border-border/60 hover:shadow-md transition-shadow flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border shrink-0", iconClass)}>
            <Icon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-sm font-semibold leading-tight">{meta.name}</CardTitle>
              <Badge variant="outline" className="text-xs font-normal">{meta.category}</Badge>
              {meta.safetyNote && (
                <Badge className="bg-red-50 text-red-600 border-red-100 text-xs gap-1">
                  <ShieldAlert size={9} />{meta.safetyNote}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs mt-1 leading-snug">{meta.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 pt-0">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/40 rounded-lg p-2">
            <div className="text-base font-bold text-foreground">{stat?.totalRuns ?? 0}</div>
            <div className="text-xs text-muted-foreground">Runs (30d)</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2">
            <div className="text-base font-bold text-green-700">{stat?.successes ?? 0}</div>
            <div className="text-xs text-green-600">Success</div>
          </div>
          <div className="bg-red-50 rounded-lg p-2">
            <div className="text-base font-bold text-red-700">{stat?.failures ?? 0}</div>
            <div className="text-xs text-red-600">Failed</div>
          </div>
        </div>

        {successRate !== null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Success rate</span>
              <span className={cn("font-medium", successRate >= 90 ? "text-green-600" : successRate >= 70 ? "text-yellow-600" : "text-red-600")}>
                {successRate}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", successRate >= 90 ? "bg-green-500" : successRate >= 70 ? "bg-yellow-500" : "bg-red-500")}
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
          <div className="flex items-center gap-1.5 min-w-0">
            {stat ? <StatusBadge status={stat.lastStatus} /> : <StatusBadge status="unknown" />}
            {stat?.lastRun && (
              <span className="text-xs text-muted-foreground truncate">
                {formatDistanceToNow(new Date(stat.lastRun), { addSuffix: true })}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2.5 shrink-0 gap-1"
            disabled={running === taskKey}
            onClick={() => onRun(taskKey)}
          >
            <Play size={11} />
            {running === taskKey ? "Running..." : "Run Now"}
          </Button>
        </div>

        {stat?.lastMessage && (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1.5 leading-relaxed truncate" title={stat.lastMessage}>
            {stat.lastMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CountdownTimer({ lastRun }: { lastRun: string | null }) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    const calc = () => {
      if (!lastRun) { setSecondsLeft(300); return; }
      const elapsed = (Date.now() - new Date(lastRun).getTime()) / 1000;
      setSecondsLeft(Math.max(0, Math.ceil(300 - (elapsed % 300))));
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [lastRun]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return (
    <span className="font-mono font-bold text-emerald-700">
      {mins}:{String(secs).padStart(2, "0")}
    </span>
  );
}

export default function AutomationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading } = useQuery<AutomationStats>({
    queryKey: ["automation-stats"],
    queryFn: () => apiFetch("/api/admin/automation/stats"),
    refetchInterval: 30_000,
  });

  const { data: logs = [] } = useQuery<CronLog[]>({
    queryKey: ["admin-cron-logs"],
    queryFn: () => apiFetch("/api/admin/cron-logs?limit=30"),
    refetchInterval: 30_000,
  });

  const { data: pendingTerminations = [], refetch: refetchPending } = useQuery<PendingTermination[]>({
    queryKey: ["pending-terminations"],
    queryFn: () => apiFetch("/api/admin/pending-terminations"),
    refetchInterval: 60_000,
  });

  const { data: kbStats } = useQuery({
    queryKey: ["kb-stats-automation"],
    queryFn: () => apiFetch("/api/kb/articles?limit=200"),
  });
  const articleCount = Array.isArray(kbStats) ? kbStats.length : 0;

  const [runningTask, setRunningTask] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);

  const runTaskMutation = useMutation({
    mutationFn: (task: string) => apiFetch(`/api/admin/cron/run/${task}`, { method: "POST" }),
    onMutate: (task) => setRunningTask(task),
    onSettled: () => {
      setRunningTask(null);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["automation-stats"] });
        queryClient.invalidateQueries({ queryKey: ["admin-cron-logs"] });
      }, 3000);
    },
    onSuccess: (_, task) => {
      toast({ title: "Task started", description: `${TASK_META[task]?.name ?? task} is now running` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const runAllMutation = useMutation({
    mutationFn: () => apiFetch("/api/admin/cron/run", { method: "POST" }),
    onMutate: () => setRunningAll(true),
    onSettled: () => {
      setRunningAll(false);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["automation-stats"] });
        queryClient.invalidateQueries({ queryKey: ["admin-cron-logs"] });
      }, 5000);
    },
    onSuccess: () => toast({ title: "All tasks started", description: "Running all automation tasks now" }),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const terminateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/services/${id}/terminate`, { method: "POST" }),
    onSuccess: (_, id) => {
      toast({ title: "Service terminated", description: "Service has been permanently terminated." });
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ["pending-terminations"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const cancelTerminationMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/services/${id}/cancel-termination`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Termination cancelled", description: "Service returned to suspended status." });
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ["pending-terminations"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const clearLogsMutation = useMutation({
    mutationFn: () => apiFetch("/api/admin/cron-logs", { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Logs cleared", description: "Removed cron logs older than 30 days" });
      queryClient.invalidateQueries({ queryKey: ["admin-cron-logs"] });
    },
  });

  const totalRuns30d = stats?.stats.reduce((s, t) => s + t.totalRuns, 0) ?? 0;
  const totalFailures30d = stats?.stats.reduce((s, t) => s + t.failures, 0) ?? 0;
  const overallRate = totalRuns30d > 0
    ? Math.round(((totalRuns30d - totalFailures30d) / totalRuns30d) * 100)
    : 100;

  const statsByTask: Record<string, TaskStat> = {};
  stats?.stats.forEach(s => { statsByTask[s.task] = s; });

  const categories = Array.from(new Set(ALL_TASKS.map(k => TASK_META[k]?.category ?? "Other")));

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <Zap size={28} className="text-primary" style={{ color: BRAND }} />
            Automation Settings
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            All billing, suspension, email, and backup tasks run <strong>fully automatically</strong> every 5 minutes — no manual action needed.
          </p>
        </div>
        <Button
          onClick={() => runAllMutation.mutate()}
          disabled={runningAll}
          variant="outline"
          className="gap-2"
        >
          <PlayCircle size={16} />
          {runningAll ? "Running..." : "Run All Now"}
        </Button>
      </div>

      {/* ── AUTO-SCHEDULER ACTIVE BANNER ─────────────────────────────────── */}
      <div className="rounded-2xl border-2 p-5" style={{ borderColor: BRAND + "33", background: BRAND + "06" }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: BRAND + "15" }}>
              <Activity size={22} className="animate-pulse" style={{ color: BRAND }} />
            </div>
            <div>
              <p className="font-bold text-foreground text-base">Automation Engine Active</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Running automatically every <strong>5 minutes</strong> in the background — 24/7, no manual intervention required.
              </p>
            </div>
          </div>
          <div className="sm:ml-auto flex flex-wrap items-center gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-medium mb-0.5">Next Run In</p>
              <CountdownTimer lastRun={stats?.lastCronRun ?? null} />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-medium mb-0.5">Last Run</p>
              <p className="text-sm font-semibold text-foreground">
                {stats?.lastCronRun
                  ? formatDistanceToNow(new Date(stats.lastCronRun), { addSuffix: true })
                  : "Starting..."}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-medium mb-0.5">Active Tasks</p>
              <p className="text-sm font-bold" style={{ color: BRAND }}>{ALL_TASKS.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── PENDING TERMINATION PANEL (critical — shown prominently) ─────── */}
      {pendingTerminations.length > 0 && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} className="text-red-600" />
            </div>
            <div>
              <p className="font-bold text-red-800 text-base">
                {pendingTerminations.length} Service{pendingTerminations.length > 1 ? "s" : ""} Pending Termination
              </p>
              <p className="text-sm text-red-600 mt-0.5">
                These services are 30+ days overdue. <strong>Your manual approval is required</strong> — nothing will be deleted automatically.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {pendingTerminations.map(pt => (
              <div key={pt.id} className="bg-white border border-red-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">{pt.planName}</span>
                    {pt.domain && <span className="text-xs text-slate-500 font-mono">{pt.domain}</span>}
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">30+ Days Overdue</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span>👤 {pt.clientName}</span>
                    {pt.clientEmail && <span>{pt.clientEmail}</span>}
                    <span>💰 PKR {pt.overdueAmount.toLocaleString()} overdue</span>
                    {pt.dueDate && <span>📅 Due: {new Date(pt.dueDate).toLocaleDateString("en-PK")}</span>}
                    {pt.flaggedAt && <span>🚩 Flagged: {formatDistanceToNow(new Date(pt.flaggedAt), { addSuffix: true })}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1 border-slate-300"
                    onClick={() => cancelTerminationMutation.mutate(pt.id)}
                    disabled={cancelTerminationMutation.isPending}
                  >
                    <RefreshCw size={11} /> Keep Service
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs gap-1 bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => {
                      if (confirm(`Permanently terminate ${pt.planName} (${pt.domain ?? pt.clientName})? This cannot be undone.`)) {
                        terminateMutation.mutate(pt.id);
                      }
                    }}
                    disabled={terminateMutation.isPending}
                  >
                    <Trash2 size={11} /> Terminate Now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LIFECYCLE RULES ───────────────────────────────────────────────── */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Timer size={15} style={{ color: BRAND }} />
            Service Lifecycle Rules
          </CardTitle>
          <CardDescription className="text-xs">Exactly how the automation engine handles unpaid invoices — step by step.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { label: "Invoice Created", sub: "14 days before due", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
              { arrow: true },
              { label: "Due Date Passes", sub: "Status: Overdue", color: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500" },
              { arrow: true },
              { label: "3 Days Overdue", sub: "Service Suspended", color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
              { arrow: true },
              { label: "15 Days Overdue", sub: "Warning Email Sent", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-400" },
              { arrow: true },
              { label: "30 Days Overdue", sub: "Pending Termination ⚠️", color: "bg-red-100 text-red-800 border-red-300 font-bold", dot: "bg-red-600" },
              { arrow: true },
              { label: "Admin Approves", sub: "Permanently Terminated", color: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-500" },
            ].map((step, i) =>
              (step as any).arrow ? (
                <ArrowRight key={i} size={14} className="text-slate-400 shrink-0" />
              ) : (
                <div key={i} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${(step as any).color}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${(step as any).dot}`} />
                  <div>
                    <div className="font-semibold text-[11px]">{(step as any).label}</div>
                    <div className="text-[10px] opacity-75">{(step as any).sub}</div>
                  </div>
                </div>
              )
            )}
          </div>
          <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2.5 flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-800">
              <strong>Auto-Unsuspend:</strong> As soon as a payment is verified and marked paid, the suspended service is automatically reactivated within 5 minutes — no manual action needed.
            </p>
          </div>
          <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5 flex items-start gap-2">
            <ShieldAlert size={14} className="text-red-600 mt-0.5 shrink-0" />
            <p className="text-xs text-red-800">
              <strong>Termination Safety:</strong> No data is ever deleted automatically. At 30 days, the system sends you a WhatsApp alert and flags the service in this panel. You (Muhammad Arslan) must manually approve termination.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium mb-1">Last Cron Run</div>
            <div className="text-base font-bold text-foreground">
              {stats?.lastCronRun
                ? formatDistanceToNow(new Date(stats.lastCronRun), { addSuffix: true })
                : "No runs yet"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {stats?.lastCronRun
                ? new Date(stats.lastCronRun).toLocaleString("en-PK")
                : "—"}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium mb-1">Active Tasks</div>
            <div className="text-2xl font-bold text-foreground">{ALL_TASKS.length}</div>
            <div className="text-xs text-green-600 mt-0.5">{stats?.activeTasks ?? 0} have run (30d)</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium mb-1">Total Runs (30d)</div>
            <div className="text-2xl font-bold text-foreground">{totalRuns30d.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{totalFailures30d} failures</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium mb-1">Success Rate</div>
            <div className={cn("text-2xl font-bold", overallRate >= 90 ? "text-green-600" : overallRate >= 70 ? "text-yellow-600" : "text-red-600")}>
              {overallRate}%
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1.5">
              <div className={cn("h-full rounded-full", overallRate >= 90 ? "bg-green-500" : "bg-yellow-500")} style={{ width: `${overallRate}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks by category */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} className="h-56 animate-pulse bg-muted/30 border-border/40" />
          ))}
        </div>
      ) : (
        categories.map(cat => {
          const catTasks = ALL_TASKS.filter(k => TASK_META[k]?.category === cat);
          return (
            <div key={cat} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{cat} Tasks</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catTasks.map(taskKey => (
                  <TaskCard
                    key={taskKey}
                    taskKey={taskKey}
                    stat={statsByTask[taskKey]}
                    onRun={task => runTaskMutation.mutate(task)}
                    running={runningTask}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* SEO & Sitemap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search size={16} className="text-primary" style={{ color: BRAND }} />
              SEO Auto-Generation
            </CardTitle>
            <CardDescription className="text-xs">
              Meta titles and descriptions are automatically generated for all KB articles from their title and excerpt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-green-600" />
                <span className="text-sm font-medium text-green-800">SEO Active</span>
              </div>
              <Badge className="bg-green-100 text-green-700">{articleCount} articles</Badge>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-500" /> Dynamic &lt;title&gt; tags per article</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-500" /> Meta description from article excerpt</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-500" /> Open Graph tags for social sharing</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-500" /> Breadcrumb structured data</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe size={16} className="text-primary" style={{ color: BRAND }} />
              Sitemap.xml
            </CardTitle>
            <CardDescription className="text-xs">
              Auto-generated sitemap covers all KB articles, categories, and static pages for Google Search Console.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2">
                <BookOpen size={15} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-800">{articleCount + 9 + 2} URLs indexed</span>
              </div>
              <span className="text-xs text-blue-600">Live</span>
            </div>
            <div className="flex gap-2">
              <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                  <ExternalLink size={12} /> View sitemap.xml
                </Button>
              </a>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => {
                  navigator.clipboard.writeText("https://noehost.com/sitemap.xml");
                  toast({ title: "Copied!", description: "Sitemap URL copied to clipboard" });
                }}
              >
                Copy URL
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Submit this URL to <strong>Google Search Console</strong> and <strong>Bing Webmaster Tools</strong> to get your Help Center indexed.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent logs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Automation Logs</h3>
          <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground" onClick={() => clearLogsMutation.mutate()}>
            Clear old logs
          </Button>
        </div>
        <Card className="border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 border-b border-border/60">
                <tr>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Task</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium w-56">Message</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No automation logs yet — tasks run every 5 minutes automatically.
                    </td>
                  </tr>
                ) : logs.map(log => (
                  <tr key={log.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground/70">{TASK_META[log.task]?.name ?? log.task}</td>
                    <td className="px-4 py-2.5">
                      {log.status === "success" && <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={11} /> Success</span>}
                      {log.status === "failed"  && <span className="text-red-600 flex items-center gap-1"><XCircle size={11} /> Failed</span>}
                      {log.status === "skipped" && <span className="text-yellow-600 flex items-center gap-1"><AlertTriangle size={11} /> Skipped</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">{log.message ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.executedAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
