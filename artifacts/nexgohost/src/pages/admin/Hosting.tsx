import { useState } from "react";
import { Server, Database, Activity, Search, HardDrive, XCircle, PauseCircle, PlayCircle, Trash2, AlertTriangle, Zap, Key, LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface HostingService {
  id: string; clientId: string; clientName: string; planName: string;
  domain: string | null; username: string | null; serverIp: string | null;
  status: string; billingCycle: string | null; nextDueDate: string | null;
  sslStatus: string; diskUsed: string | null; bandwidthUsed: string | null;
  cancelRequested: boolean; cancelReason: string | null; createdAt: string;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  suspended: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  terminated: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
};

export default function AdminHosting() {
  const [activeTab, setActiveTab] = useState<"services" | "plans">("services");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [linkingServers, setLinkingServers] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: services = [], isLoading: isLoadingServices } = useQuery<HostingService[]>({
    queryKey: ["admin-hosting"],
    queryFn: () => apiFetch("/api/admin/hosting"),
  });

  const { data: plans = [], isLoading: isLoadingPlans } = useQuery<any[]>({
    queryKey: ["admin-packages"],
    queryFn: () => apiFetch("/api/admin/packages"),
  });

  const filtered = services.filter(s => {
    const matchSearch = (s.domain || "").toLowerCase().includes(search.toLowerCase()) ||
      s.clientName.toLowerCase().includes(search.toLowerCase()) ||
      s.planName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const cancelRequests = services.filter(s => s.cancelRequested);

  const linkAllServers = async () => {
    setLinkingServers(true);
    try {
      const result = await apiFetch("/api/admin/hosting/link-all-servers", { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["admin-hosting"] });
      toast({
        title: "Services linked",
        description: result.message,
      });
    } catch (err: any) {
      toast({ title: "Link failed", description: err.message, variant: "destructive" });
    } finally {
      setLinkingServers(false);
    }
  };

  const action = async (id: string, endpoint: string, label: string) => {
    try {
      const result = await apiFetch(`/api/admin/hosting/${id}/${endpoint}`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["admin-hosting"] });
      toast({ title: `Service ${label}` });
      if (result.credentials) {
        toast({
          title: "Credentials Created",
          description: `Username: ${result.credentials.username} | Password: ${result.credentials.password}`,
        });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Hosting Manager</h2>
          <p className="text-muted-foreground mt-1">Manage active services and hosting plans.</p>
        </div>
        <div className="flex items-center gap-3">
          {cancelRequests.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              <AlertTriangle size={14} />
              {cancelRequests.length} cancellation request{cancelRequests.length > 1 ? "s" : ""} pending
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={linkAllServers}
            disabled={linkingServers}
            className="gap-2 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
          >
            <LinkIcon size={14} className={linkingServers ? "animate-pulse" : ""} />
            {linkingServers ? "Linking..." : "Link All Services to Servers"}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-1.5 flex gap-1 w-fit">
        {(["services", "plans"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-secondary"}`}>
            {tab === "services" ? <Server size={16} /> : <Database size={16} />}
            {tab === "services" ? "Active Services" : "Hosting Plans"}
          </button>
        ))}
      </div>

      {activeTab === "services" && (
        <div className="space-y-4">
          {/* Cancellation requests banner */}
          {cancelRequests.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2"><AlertTriangle size={14} /> Pending Cancellation Requests</h3>
              {cancelRequests.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-t border-red-500/10">
                  <div>
                    <span className="text-sm font-medium text-foreground">{s.domain || s.planName}</span>
                    <span className="text-xs text-muted-foreground ml-2">({s.clientName}) — Reason: {s.cancelReason}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 bg-red-500 hover:bg-red-600 text-white" onClick={() => action(s.id, "cancel", "cancelled")}>
                      Approve Cancellation
                    </Button>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => {
                      apiFetch(`/api/admin/hosting/${s.id}`, { method: "PUT", body: JSON.stringify({ cancelRequested: false }) })
                        .then(() => { queryClient.invalidateQueries({ queryKey: ["admin-hosting"] }); toast({ title: "Request dismissed" }); })
                        .catch(err => toast({ title: "Error", description: err.message, variant: "destructive" }));
                    }}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 bg-card border-border" placeholder="Search domain, client, plan..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1.5">
              {["all", "active", "suspended", "terminated", "pending"].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs rounded-lg border capitalize transition-all ${statusFilter === s ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="p-4 font-medium text-muted-foreground">Domain</th>
                  <th className="p-4 font-medium text-muted-foreground">Client</th>
                  <th className="p-4 font-medium text-muted-foreground">Plan</th>
                  <th className="p-4 font-medium text-muted-foreground">Next Due</th>
                  <th className="p-4 font-medium text-muted-foreground">Status</th>
                  <th className="p-4 font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingServices ? (
                  <tr><td colSpan={6} className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No services found</td></tr>
                ) : filtered.map(s => (
                  <tr key={s.id} className={`border-b border-border/50 hover:bg-secondary/20 transition-colors ${s.cancelRequested ? "bg-red-500/3" : ""}`}>
                    <td className="p-4">
                      <div className="font-medium text-foreground">{s.domain || "—"}</div>
                      <div className="text-xs text-muted-foreground">{s.serverIp || "No server"}</div>
                      {s.cancelRequested && <div className="text-xs text-red-400 flex items-center gap-1 mt-0.5"><AlertTriangle size={10} /> Cancel requested</div>}
                    </td>
                    <td className="p-4 text-muted-foreground">{s.clientName}</td>
                    <td className="p-4">
                      <div>{s.planName}</div>
                      <div className="text-xs text-muted-foreground capitalize">{s.billingCycle || "monthly"}</div>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">
                      {s.nextDueDate ? format(new Date(s.nextDueDate), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${statusColors[s.status] || "bg-secondary border-border text-muted-foreground"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 justify-end">
                        {s.status === "active" && (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                            onClick={() => action(s.id, "suspend", "suspended")}>
                            <PauseCircle size={13} /> Suspend
                          </Button>
                        )}
                        {s.status === "suspended" && (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-green-400 border-green-500/30 hover:bg-green-500/10"
                            onClick={() => action(s.id, "unsuspend", "unsuspended")}>
                            <PlayCircle size={13} /> Unsuspend
                          </Button>
                        )}
                        {s.status === "pending" && (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                            onClick={() => action(s.id, "provision", "provisioned")}>
                            <Zap size={13} /> Create Account
                          </Button>
                        )}
                        {s.status !== "terminated" && (
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => { if (confirm(`Terminate service for ${s.domain}? This is irreversible.`)) action(s.id, "terminate", "terminated"); }}>
                            <Trash2 size={13} /> Terminate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "plans" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoadingPlans ? (
            <div className="col-span-3 p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" /></div>
          ) : plans.filter(p => p.isActive).map(plan => (
            <div key={plan.id} className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-colors">
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-3xl font-bold">${plan.price}</span>
                <span className="text-muted-foreground mb-1">/mo</span>
                {plan.yearlyPrice && <span className="ml-2 text-sm text-muted-foreground">(${plan.yearlyPrice}/yr)</span>}
              </div>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm text-foreground/80"><HardDrive size={14} className="text-primary" /> {plan.diskSpace}</li>
                <li className="flex items-center gap-2 text-sm text-foreground/80"><Activity size={14} className="text-primary" /> {plan.bandwidth} Bandwidth</li>
                <li className="flex items-center gap-2 text-sm text-foreground/80"><Database size={14} className="text-primary" /> {plan.databases} MySQL DBs</li>
              </ul>
              {plan.module && plan.module !== "none" && (
                <div className="mt-3 px-2 py-1 bg-primary/10 text-primary text-xs rounded-lg inline-block capitalize">{plan.module}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
