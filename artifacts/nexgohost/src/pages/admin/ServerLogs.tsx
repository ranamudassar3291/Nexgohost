import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Server, RefreshCw, Trash2, ChevronDown, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

interface ServerLog {
  id: string;
  serviceId: string | null;
  serverId: string | null;
  action: string;
  status: string;
  request: string | null;
  response: string | null;
  errorMessage: string | null;
  createdAt: string;
}

function JsonBlock({ data }: { data: string | null }) {
  if (!data) return <span className="text-muted-foreground italic text-xs">—</span>;
  try {
    const parsed = JSON.parse(data);
    return (
      <pre className="text-xs text-emerald-400 bg-black/40 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    );
  } catch {
    return <pre className="text-xs text-muted-foreground bg-black/20 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{data}</pre>;
  }
}

function LogRow({ log }: { log: ServerLog }) {
  const [expanded, setExpanded] = useState(false);
  const isSuccess = log.status === "success";

  return (
    <div className="border border-white/10 rounded-lg bg-white/5 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded
          ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        {isSuccess
          ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
        <span className="font-mono text-sm font-medium text-foreground">{log.action}</span>
        <Badge variant="outline" className={isSuccess ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}>
          {log.status}
        </Badge>
        {log.serviceId && (
          <span className="text-xs text-muted-foreground hidden sm:block">
            Service: {log.serviceId.slice(0, 8)}…
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground shrink-0">
          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
          {log.errorMessage && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">Error</p>
              <p className="text-sm text-red-400 bg-red-500/10 rounded px-3 py-2">{log.errorMessage}</p>
            </div>
          )}
          {log.request && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">Request Parameters</p>
              <JsonBlock data={log.request} />
            </div>
          )}
          {log.response && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">WHM API Response</p>
              <JsonBlock data={log.response} />
            </div>
          )}
          <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
            {log.serverId && <span>Server ID: {log.serverId.slice(0, 8)}…</span>}
            {log.serviceId && <span>Service ID: {log.serviceId.slice(0, 8)}…</span>}
            <span>Time: {new Date(log.createdAt).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ServerLogs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState("");

  const { data: logs = [], isLoading, refetch } = useQuery<ServerLog[]>({
    queryKey: ["admin-server-logs"],
    queryFn: () => apiFetch("/api/admin/server-logs?limit=200"),
    refetchInterval: 30000,
  });

  const clearMutation = useMutation({
    mutationFn: () => apiFetch("/api/admin/server-logs", { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-server-logs"] });
      toast({ title: "Cleared", description: "Logs older than 30 days have been removed." });
    },
    onError: () => toast({ title: "Error", description: "Failed to clear logs.", variant: "destructive" }),
  });

  const filtered = logs.filter(log => {
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    if (actionFilter && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) return false;
    return true;
  });

  const successCount = logs.filter(l => l.status === "success").length;
  const failedCount = logs.filter(l => l.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Server className="w-6 h-6 text-violet-400" />
            Server Logs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">WHM / cPanel API call history and responses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-400 border-red-500/30 hover:bg-red-500/10"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Old Logs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Total Entries</p>
            <p className="text-2xl font-bold text-foreground">{logs.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Successful</p>
            <p className="text-2xl font-bold text-emerald-400">{successCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Failed</p>
            <p className="text-2xl font-bold text-red-400">{failedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Filter by action…"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="bg-white/5 border-white/10 w-52"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white/5 border-white/10 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground self-center">
              {filtered.length} of {logs.length} entries
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading logs…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Server className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">No server logs yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Logs appear here when hosting accounts are activated via WHM.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-2">
              <div className="space-y-2">
                {filtered.map(log => (
                  <LogRow key={log.id} log={log} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
