import { useState } from "react";
import { useGetAllMigrations, useUpdateMigrationStatus } from "@workspace/api-client-react";
import { ArrowRightLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  in_progress: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  failed: "Failed",
};

export default function AdminMigrations() {
  const { data: migrations = [], isLoading, refetch } = useGetAllMigrations();
  const updateStatus = useUpdateMigrationStatus();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const filtered = migrations.filter(m =>
    m.domain.toLowerCase().includes(search.toLowerCase()) ||
    m.clientName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleStatusUpdate = (id: string, status: string, progress: number) => {
    updateStatus.mutate({ id, data: { status: status as "pending" | "in_progress" | "completed" | "failed" } }, {
      onSuccess: () => { toast({ title: "Status updated" }); refetch(); },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Website Migrations</h2>
        <p className="text-muted-foreground mt-1">Manage hosting migration requests</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9 bg-card border-border max-w-md" placeholder="Search migrations..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="space-y-4">
        {filtered.map(migration => (
          <div key={migration.id} className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-foreground text-lg">{migration.domain}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[migration.status]}`}>
                    {statusLabels[migration.status]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Client: {migration.clientName}</p>
                <p className="text-sm text-muted-foreground">From: {migration.oldHostingProvider || "Unknown"} · cPanel: {migration.oldCpanelHost}</p>
                <p className="text-sm text-muted-foreground">Requested: {format(new Date(migration.requestedAt), "MMM d, yyyy")}</p>
                {migration.notes && <p className="text-sm text-muted-foreground mt-1 italic">Notes: {migration.notes}</p>}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="text-foreground font-medium">{migration.progress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${migration.status === "completed" ? "bg-green-500" : migration.status === "failed" ? "bg-red-500" : "bg-primary"}`}
                  style={{ width: `${migration.progress}%` }}
                />
              </div>
            </div>

            {migration.status !== "completed" && migration.status !== "failed" && (
              <div className="flex gap-2">
                {migration.status === "pending" && (
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs" onClick={() => handleStatusUpdate(migration.id, "in_progress", 10)}>
                    Start Migration
                  </Button>
                )}
                {migration.status === "in_progress" && (
                  <>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" onClick={() => handleStatusUpdate(migration.id, "completed", 100)}>
                      Mark Complete
                    </Button>
                    <Button size="sm" variant="destructive" className="text-xs" onClick={() => handleStatusUpdate(migration.id, "failed", migration.progress || 0)}>
                      Mark Failed
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No migrations found</div>
        )}
      </div>
    </div>
  );
}
