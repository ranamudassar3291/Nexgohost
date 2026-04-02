import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, CheckCircle, XCircle, AlertTriangle, Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface FraudLog {
  id: string;
  orderId: string;
  clientId: string;
  ipAddress: string | null;
  email: string | null;
  riskScore: string;
  reasons: string[];
  status: "flagged" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const statusColors: Record<string, string> = {
  flagged: "bg-[rgba(255,82,82,0.10)] text-[#FF6B6B] border-[rgba(255,82,82,0.30)]",
  approved: "bg-green-500/10 text-green-400 border-green-500/20",
  rejected: "bg-secondary text-muted-foreground border-border",
};

export default function FraudLogs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actioning, setActioning] = useState<string | null>(null);

  const { data: logs = [], isLoading } = useQuery<FraudLog[]>({
    queryKey: ["admin-fraud-logs"],
    queryFn: () => apiFetch("/api/admin/fraud-logs"),
  });

  const filtered = logs.filter(l => {
    const matchSearch = (l.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.ipAddress || "").includes(search) ||
      l.orderId.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setActioning(id);
    try {
      await apiFetch(`/api/admin/fraud-logs/${id}/${action}`, { method: "PUT" });
      queryClient.invalidateQueries({ queryKey: ["admin-fraud-logs"] });
      toast({ title: action === "approve" ? "Order approved" : "Order rejected", description: "Fraud log updated." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setActioning(null); }
  };

  const getRiskColor = (score: number) => {
    if (score >= 60) return "text-red-400";
    if (score >= 40) return "text-orange-400";
    return "text-yellow-400";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Fraud Logs</h2>
          <p className="text-muted-foreground mt-1">Review flagged orders and manage fraud protection.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          <ShieldAlert size={14} />
          {logs.filter(l => l.status === "flagged").length} flagged order(s)
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 bg-card border-border" placeholder="Search by email, IP, or order ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">All Status</option>
          <option value="flagged">Flagged</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="p-4 text-sm font-medium text-muted-foreground text-left">Order ID</th>
                <th className="p-4 text-sm font-medium text-muted-foreground text-left">Email</th>
                <th className="p-4 text-sm font-medium text-muted-foreground text-left">IP Address</th>
                <th className="p-4 text-sm font-medium text-muted-foreground text-left">Risk Score</th>
                <th className="p-4 text-sm font-medium text-muted-foreground text-left">Reasons</th>
                <th className="p-4 text-sm font-medium text-muted-foreground text-left">Status</th>
                <th className="p-4 text-sm font-medium text-muted-foreground text-left">Date</th>
                <th className="p-4 text-sm font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="p-8 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                  <ShieldAlert size={32} className="mx-auto mb-2 text-green-500/50" />
                  No fraud logs found.
                </td></tr>
              ) : filtered.map(log => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="p-4 font-mono text-xs text-muted-foreground">{log.orderId.slice(0, 8).toUpperCase()}</td>
                  <td className="p-4 text-sm">{log.email || "—"}</td>
                  <td className="p-4 text-sm font-mono text-muted-foreground">{log.ipAddress || "—"}</td>
                  <td className="p-4">
                    <span className={`text-lg font-bold ${getRiskColor(Number(log.riskScore))}`}>{log.riskScore}</span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {(log.reasons || []).map((r, i) => (
                        <span key={i} className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs">{r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[log.status]}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{format(new Date(log.createdAt), "MMM d, HH:mm")}</td>
                  <td className="p-4">
                    {log.status === "flagged" && (
                      <div className="flex items-center gap-1.5 justify-end">
                        <Button size="sm" variant="outline"
                          className="h-8 gap-1.5 text-green-500 border-green-500/30 hover:bg-green-500/10"
                          disabled={actioning === log.id}
                          onClick={() => handleAction(log.id, "approve")}
                        >
                          <CheckCircle size={13} /> Approve
                        </Button>
                        <Button size="sm" variant="outline"
                          className="h-8 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                          disabled={actioning === log.id}
                          onClick={() => handleAction(log.id, "reject")}
                        >
                          <XCircle size={13} /> Reject
                        </Button>
                      </div>
                    )}
                    {log.status !== "flagged" && (
                      <span className="text-xs text-muted-foreground text-right block">
                        {log.reviewedAt ? format(new Date(log.reviewedAt), "MMM d") : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
