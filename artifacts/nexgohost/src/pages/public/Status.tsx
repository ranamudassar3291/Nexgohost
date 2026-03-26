import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Server, Globe, Wifi, RefreshCw, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface NodeStatus {
  id: string;
  name: string;
  type: string;
  sortOrder: number;
  status: "online" | "offline";
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  hosting: Server,
  vps: Server,
  network: Wifi,
  dns: Globe,
  default: Server,
};

const TYPE_LABELS: Record<string, string> = {
  hosting: "Hosting Nodes",
  vps: "VPS Nodes",
  network: "Network",
  dns: "DNS",
};

export default function StatusPage() {
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery<{ nodes: NodeStatus[] }>({
    queryKey: ["status-nodes"],
    queryFn: () => apiFetch("/api/status/nodes"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const nodes = data?.nodes ?? [];
  const groups: Record<string, NodeStatus[]> = {};
  nodes.forEach(n => {
    const key = n.type ?? "default";
    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  });

  const allOnline = nodes.length > 0 && nodes.every(n => n.status === "online");
  const anyOffline = nodes.some(n => n.status === "offline");
  const onlineCount = nodes.filter(n => n.status === "online").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Server size={16} className="text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">System Status</h1>
              <p className="text-xs text-muted-foreground">Noehost Infrastructure</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Overall status banner */}
        <div className={`rounded-2xl border px-6 py-5 flex items-center gap-4 ${
          isLoading ? "bg-muted/30 border-border/40" :
          allOnline ? "bg-green-500/5 border-green-500/20" :
          anyOffline ? "bg-red-500/5 border-red-500/20" :
          "bg-muted/30 border-border/40"
        }`}>
          {isLoading ? (
            <Loader2 size={28} className="text-muted-foreground animate-spin" />
          ) : allOnline ? (
            <CheckCircle2 size={28} className="text-green-500 flex-shrink-0" />
          ) : (
            <XCircle size={28} className="text-red-500 flex-shrink-0" />
          )}
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {isLoading ? "Checking status…" :
               nodes.length === 0 ? "No nodes configured" :
               allOnline ? "All Systems Operational" :
               anyOffline ? "Partial Outage Detected" : "Checking…"}
            </h2>
            {!isLoading && nodes.length > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {onlineCount} of {nodes.length} services online
              </p>
            )}
          </div>
          {dataUpdatedAt > 0 && (
            <p className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Nodes by group */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : nodes.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No server nodes have been configured yet.
          </div>
        ) : (
          Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([type, typeNodes]) => {
            const Icon = TYPE_ICONS[type] ?? TYPE_ICONS.default;
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={14} className="text-muted-foreground" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {TYPE_LABELS[type] ?? type}
                  </h3>
                </div>
                <div className="space-y-2">
                  {typeNodes.sort((a, b) => a.sortOrder - b.sortOrder).map(node => (
                    <div
                      key={node.id}
                      className="flex items-center justify-between px-5 py-3.5 rounded-xl border border-border/50 bg-card hover:bg-card/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${node.status === "online" ? "bg-green-500" : "bg-red-500"} animate-pulse`} />
                        <span className="text-sm font-medium text-foreground">{node.name}</span>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                        node.status === "online"
                          ? "bg-green-500/10 text-green-600 border-green-500/20"
                          : "bg-red-500/10 text-red-600 border-red-500/20"
                      }`}>
                        {node.status === "online" ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {node.status === "online" ? "Operational" : "Offline"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}

        {/* Footer */}
        <div className="border-t border-border/40 pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Status is checked every 60 seconds. For support, visit{" "}
            <a href="/client/tickets" className="text-primary hover:underline">our support portal</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
