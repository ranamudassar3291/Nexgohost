import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, CheckCircle, XCircle, RefreshCw, Search, Trash2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface CronLog {
  id: string;
  task: string;
  status: "success" | "failed" | "skipped";
  message: string | null;
  executedAt: string;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const statusColors: Record<string, string> = {
  success: "bg-green-500/10 text-green-400 border-green-500/20",
  failed: "bg-[rgba(255,82,82,0.10)] text-[#FF6B6B] border-[rgba(255,82,82,0.30)]",
  skipped: "bg-secondary text-muted-foreground border-border",
};

const TASK_LABELS: Record<string, string> = {
  "billing:invoice_generation": "Invoice Generation",
  "billing:auto_suspend": "Auto Suspend Overdue",
  "domains:renewal_check": "Domain Renewal Check",
  "emails:invoice_reminders": "Invoice Email Reminders",
};

export default function CronLogs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [runningCron, setRunningCron] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  const { data: logs = [], isLoading } = useQuery<CronLog[]>({
    queryKey: ["admin-cron-logs"],
    queryFn: () => apiFetch("/api/admin/cron-logs?limit=100"),
    refetchInterval: 30000,
  });

  const filtered = logs.filter(l => {
    const label = TASK_LABELS[l.task] || l.task;
    const matchSearch = label.toLowerCase().includes(search.toLowerCase()) ||
      l.task.toLowerCase().includes(search.toLowerCase()) ||
      (l.message || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleRunCron = async () => {
    setRunningCron(true);
    try {
      await apiFetch("/api/admin/cron/run", { method: "POST" });
      toast({ title: "Cron tasks triggered", description: "All automation tasks are now running." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["admin-cron-logs"] });
        setRunningCron(false);
      }, 3000);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setRunningCron(false);
    }
  };

  const handleClearOld = async () => {
    if (!confirm("Clear logs older than 30 days?")) return;
    setClearingLogs(true);
    try {
      await apiFetch("/api/admin/cron-logs", { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["admin-cron-logs"] });
      toast({ title: "Old logs cleared" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setClearingLogs(false); }
  };

  const successCount = logs.filter(l => l.status === "success").length;
  const failedCount = logs.filter(l => l.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Automation Logs</h2>
          <p className="text-muted-foreground mt-1">Monitor cron tasks — billing, suspension, renewals, and email reminders.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleClearOld} disabled={clearingLogs}>
            <Trash2 size={14} /> Clear Old
          </Button>
          <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90" onClick={handleRunCron} disabled={runningCron}>
            <Play size={14} className={runningCron ? "animate-pulse" : ""} />
            {runningCron ? "Running..." : "Run Now"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Runs", value: logs.length, color: "text-foreground", bg: "bg-secondary/50", border: "border-border" },
          { label: "Successful", value: successCount, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
          { label: "Failed", value: failedCount, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4 text-center`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 bg-card border-border" placeholder="Search by task name or message..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="p-4 text-sm font-medium text-muted-foreground text-left">Status</th>
                <th className="p-4 text-sm font-medium text-muted-foreground text-left">Task</th>
                <th className="p-4 text-sm font-medium text-muted-foreground text-left">Message</th>
                <th className="p-4 text-sm font-medium text-muted-foreground text-right">Executed At</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="p-8 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">
                  <Clock size={32} className="mx-auto mb-2 opacity-30" />
                  No cron logs yet. Run a task above to see logs.
                </td></tr>
              ) : filtered.map(log => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[log.status]}`}>
                      {log.status === "success" ? <CheckCircle size={11} /> : log.status === "failed" ? <XCircle size={11} /> : <RefreshCw size={11} />}
                      {log.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium text-foreground block">{TASK_LABELS[log.task] || log.task}</span>
                    <span className="text-xs text-muted-foreground font-mono">{log.task}</span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground max-w-sm truncate">{log.message || "—"}</td>
                  <td className="p-4 text-sm text-muted-foreground text-right">{format(new Date(log.executedAt), "MMM d, yyyy HH:mm:ss")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
