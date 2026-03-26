import { useState } from "react";
import { Shield, Plus, Trash2, Loader2, RefreshCw, Server, Globe, Copy, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") || "";
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

interface WhitelistEntry {
  id: string;
  ipAddress: string;
  label: string | null;
  addedBy: string | null;
  createdAt: string;
}

function AddIpForm({ onAdd, loading }: { onAdd: (ip: string, label: string) => void; loading: boolean }) {
  const [ip, setIp] = useState("");
  const [label, setLabel] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ip.trim()) return;
    onAdd(ip.trim(), label.trim());
    setIp(""); setLabel("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 flex-wrap">
      <Input
        placeholder="IP address (e.g. 198.51.100.1)"
        value={ip}
        onChange={e => setIp(e.target.value)}
        className="flex-1 min-w-40 font-mono text-sm"
      />
      <Input
        placeholder="Label (optional)"
        value={label}
        onChange={e => setLabel(e.target.value)}
        className="flex-1 min-w-32 text-sm"
      />
      <Button type="submit" disabled={loading || !ip.trim()} size="sm" className="gap-1.5 shrink-0">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Add IP
      </Button>
    </form>
  );
}

function IpTable({ entries, onRemove, removing }: {
  entries: WhitelistEntry[];
  onRemove: (ip: string) => void;
  removing: string | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyIp = (ip: string) => {
    navigator.clipboard.writeText(ip).then(() => {
      setCopied(ip);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No IPs whitelisted yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">IP Address</th>
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Label</th>
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Added By</th>
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Added At</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr key={entry.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
              <td className="px-3 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-foreground">{entry.ipAddress}</span>
                  <button onClick={() => copyIp(entry.ipAddress)} className="text-muted-foreground hover:text-foreground transition-colors">
                    {copied === entry.ipAddress ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </td>
              <td className="px-3 py-3 text-muted-foreground">{entry.label || "—"}</td>
              <td className="px-3 py-3 text-muted-foreground text-xs">{entry.addedBy || "—"}</td>
              <td className="px-3 py-3 text-muted-foreground text-xs">
                {new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </td>
              <td className="px-3 py-3">
                <Button
                  size="sm" variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                  disabled={removing === entry.ipAddress}
                  onClick={() => onRemove(entry.ipAddress)}
                >
                  {removing === entry.ipAddress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Firewall() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [removingWhitelist, setRemovingWhitelist] = useState<string | null>(null);
  const [removingMigration, setRemovingMigration] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const { data: whitelist = [], isLoading: loadingWhitelist, refetch: refetchWhitelist } = useQuery<WhitelistEntry[]>({
    queryKey: ["ip-whitelist"],
    queryFn: () => apiFetch("/api/admin/security/ip-whitelist"),
  });

  const { data: migrationList = [], isLoading: loadingMigration, refetch: refetchMigration } = useQuery<WhitelistEntry[]>({
    queryKey: ["migration-whitelist"],
    queryFn: () => apiFetch("/api/admin/security/migration-whitelist"),
  });

  const addWhitelistMutation = useMutation({
    mutationFn: ({ ipAddress, label }: { ipAddress: string; label: string }) =>
      apiFetch("/api/admin/security/ip-whitelist", { method: "POST", body: JSON.stringify({ ipAddress, label }) }),
    onSuccess: (data) => {
      toast({ title: "IP Whitelisted", description: data.message });
      qc.invalidateQueries({ queryKey: ["ip-whitelist"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const addMigrationMutation = useMutation({
    mutationFn: ({ ipAddress, label }: { ipAddress: string; label: string }) =>
      apiFetch("/api/admin/security/migration-whitelist", { method: "POST", body: JSON.stringify({ ipAddress, label }) }),
    onSuccess: (data) => {
      toast({ title: "Migration IP Added", description: data.message });
      qc.invalidateQueries({ queryKey: ["migration-whitelist"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const removeWhitelist = async (ip: string) => {
    setRemovingWhitelist(ip);
    try {
      const data = await apiFetch(`/api/admin/security/ip-whitelist/${encodeURIComponent(ip)}`, { method: "DELETE" });
      toast({ title: "Removed", description: data.message });
      qc.invalidateQueries({ queryKey: ["ip-whitelist"] });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setRemovingWhitelist(null); }
  };

  const removeMigration = async (ip: string) => {
    setRemovingMigration(ip);
    try {
      const data = await apiFetch(`/api/admin/security/migration-whitelist/${encodeURIComponent(ip)}`, { method: "DELETE" });
      toast({ title: "Removed", description: data.message });
      qc.invalidateQueries({ queryKey: ["migration-whitelist"] });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setRemovingMigration(null); }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const data = await apiFetch("/api/admin/migrate/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexgohost-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export Complete", description: "Full data export downloaded successfully." });
    } catch (err: any) {
      toast({ title: "Export Failed", description: err.message, variant: "destructive" });
    } finally { setExportLoading(false); }
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          Firewall &amp; Security
        </h2>
        <p className="text-muted-foreground mt-1.5">
          Manage IP whitelists, migration access, and data exports. Whitelisted IPs bypass brute-force auto-blocks.
        </p>
      </div>

      {/* ── Section 1: Client IP Whitelist ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-green-400" />
            <div>
              <h3 className="font-semibold text-foreground">Client IP Whitelist</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Whitelisted IPs are never auto-blocked — even after repeated failed logins.
                Use this to grant access to a specific client who is being blocked.
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => refetchWhitelist()} className="gap-1.5 text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        <div className="px-6 py-4 border-b border-border/40 bg-muted/20">
          <AddIpForm
            onAdd={(ip, label) => addWhitelistMutation.mutate({ ipAddress: ip, label })}
            loading={addWhitelistMutation.isPending}
          />
        </div>

        <div className="px-6 py-4">
          {loadingWhitelist ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <IpTable entries={whitelist} onRemove={removeWhitelist} removing={removingWhitelist} />
          )}
        </div>

        <div className="px-6 py-3 bg-amber-500/5 border-t border-amber-500/20 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80">
            <strong>Reliability Note:</strong> Auto-blocking only triggers after 20 failed login attempts in 60 seconds — normal users are never affected.
            If a client is blocked, their IP will auto-unblock after 30 minutes. Whitelisting is only needed as an emergency backup.
          </p>
        </div>
      </div>

      {/* ── Section 2: Migration IP Whitelist ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-semibold text-foreground">Migration API Whitelist</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Only IPs in this list can access the full data export endpoint. Add your migration server's IP here before running a migration.
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => refetchMigration()} className="gap-1.5 text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        <div className="px-6 py-4 border-b border-border/40 bg-muted/20">
          <AddIpForm
            onAdd={(ip, label) => addMigrationMutation.mutate({ ipAddress: ip, label })}
            loading={addMigrationMutation.isPending}
          />
        </div>

        <div className="px-6 py-4">
          {loadingMigration ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <IpTable entries={migrationList} onRemove={removeMigration} removing={removingMigration} />
          )}
        </div>
      </div>

      {/* ── Section 3: Migration Export ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border/60">
          <div className="flex items-center gap-3 mb-1">
            <Download className="w-5 h-5 text-violet-400" />
            <h3 className="font-semibold text-foreground">Full Data Export</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Downloads a complete JSON export of all platform data (users, domains, hosting, invoices, settings, and more).
            Only your current IP will be allowed to access this — add it to the Migration Whitelist above first.
          </p>
        </div>
        <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• All user accounts, services, and billing records</p>
            <p>• Domain portfolios, transfers, and DNS settings</p>
            <p>• Platform configuration and settings</p>
            <p>• Passwords are bcrypt-hashed — safe to export</p>
          </div>
          <Button
            onClick={handleExport}
            disabled={exportLoading}
            className="gap-2 shrink-0 bg-violet-600 hover:bg-violet-700"
          >
            {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exportLoading ? "Exporting…" : "Export All Data"}
          </Button>
        </div>
        <div className="px-6 py-3 bg-red-500/5 border-t border-red-500/20 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300/80">
            <strong>Security:</strong> The export endpoint is IP-restricted to your Migration Whitelist.
            Remove your migration server IP from the whitelist once the migration is complete.
          </p>
        </div>
      </div>
    </div>
  );
}
