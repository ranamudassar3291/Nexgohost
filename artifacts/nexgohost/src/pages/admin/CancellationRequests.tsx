import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, XCircle, Loader2, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useLocation } from "wouter";

interface CancelRequest {
  id: string; clientId: string; clientName: string; planName: string; domain: string | null;
  cancelReason: string | null; cancelRequestedAt: string | null; status: string;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function CancellationRequests() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: requests = [], isLoading } = useQuery<CancelRequest[]>({
    queryKey: ["admin-cancellation-requests"],
    queryFn: () => apiFetch("/api/admin/hosting/cancellation-requests"),
    staleTime: 30000,
  });

  const action = async (id: string, endpoint: string, label: string) => {
    try {
      await apiFetch(`/api/admin/hosting/${id}/${endpoint}`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["admin-cancellation-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-hosting"] });
      toast({ title: `Request ${label}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Cancellation Requests</h2>
        <p className="text-muted-foreground mt-1">Review and action client service cancellation requests.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Requests", value: requests.length, color: "text-foreground" },
          { label: "Pending", value: requests.filter(r => r.status !== "terminated" && r.status !== "cancelled").length, color: "text-yellow-400" },
          { label: "Processed", value: requests.filter(r => r.status === "terminated" || r.status === "cancelled").length, color: "text-green-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
              <CheckCircle size={28} className="text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No cancellation requests</h3>
            <p className="text-muted-foreground text-sm mt-1">All services are in good standing.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {requests.map(req => (
              <div key={req.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-secondary/20 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center shrink-0">
                    <AlertTriangle size={18} className="text-red-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{req.planName}</span>
                      {req.domain && <span className="font-mono text-xs text-primary">{req.domain}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><User size={11} /> {req.clientName}</span>
                      {req.cancelRequestedAt && (
                        <span className="flex items-center gap-1"><Clock size={11} /> {format(new Date(req.cancelRequestedAt), "MMM d, yyyy")}</span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${
                        req.status === "active" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        req.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-red-50 text-red-600 border-red-200"
                      }`}>{req.status}</span>
                    </div>
                    {req.cancelReason && (
                      <div className="mt-2 text-sm text-foreground/70 italic bg-secondary/30 rounded-lg px-3 py-2 max-w-md">
                        "{req.cancelReason}"
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-14 sm:ml-0 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5" onClick={() => setLocation(`/admin/clients/${req.clientId}`)}>
                    <User size={12} /> View Client
                  </Button>
                  {req.status !== "terminated" && req.status !== "cancelled" && (
                    <>
                      <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10"
                        onClick={() => { if (confirm("Approve this cancellation? The service will be terminated.")) action(req.id, "cancel", "approved"); }}>
                        <CheckCircle size={12} /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5 text-muted-foreground"
                        onClick={() => action(req.id, "reject-cancel", "rejected")}>
                        <XCircle size={12} /> Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
