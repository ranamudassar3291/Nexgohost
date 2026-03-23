import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Loader2, Network, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface DnsRecord {
  id: string; type: string; name: string; value: string; ttl: number; priority: number | null;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") || "";
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new Error(`Server error (${res.status})`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

const DNS_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"];

export default function ClientDomainDns() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "A", name: "", value: "", ttl: 3600, priority: "" });

  const { data, isLoading, error } = useQuery<{ success: boolean; records: DnsRecord[] }>({
    queryKey: ["domain-dns", id],
    queryFn: () => apiFetch(`/api/domains/${id}/dns`),
    retry: false,
  });

  const records = data?.records ?? [];

  const handleAdd = async () => {
    if (!form.name.trim() || !form.value.trim()) {
      toast({ title: "Validation error", description: "Name and value are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/domains/${id}/dns`, {
        method: "POST",
        body: JSON.stringify({ type: form.type, name: form.name.trim(), value: form.value.trim(), ttl: form.ttl, priority: form.priority ? Number(form.priority) : undefined }),
      });
      toast({ title: "DNS record added" });
      setForm({ type: "A", name: "", value: "", ttl: 3600, priority: "" });
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ["domain-dns", id] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm("Delete this DNS record?")) return;
    setDeletingId(recordId);
    try {
      await apiFetch(`/api/domains/${id}/dns/${recordId}`, { method: "DELETE" });
      toast({ title: "Record deleted" });
      queryClient.invalidateQueries({ queryKey: ["domain-dns", id] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/client/domains")} className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Network size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-foreground">DNS Management</h1>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="font-semibold text-foreground">DNS Records</p>
            <p className="text-xs text-muted-foreground mt-0.5">Manage A, CNAME, MX and other records</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => queryClient.invalidateQueries({ queryKey: ["domain-dns", id] })}>
              <RefreshCw size={13} /> Refresh
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(v => !v)}>
              <Plus size={13} /> Add Record
            </Button>
          </div>
        </div>

        {showAdd && (
          <div className="p-5 border-b border-border bg-secondary/30 space-y-3">
            <p className="text-sm font-medium text-foreground">New DNS Record</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                >
                  {DNS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="@ or subdomain" className="h-9" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Value</label>
                <Input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="IP address or hostname" className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">TTL (seconds)</label>
                <Input type="number" value={form.ttl} onChange={e => setForm(f => ({ ...f, ttl: Number(e.target.value) }))} className="h-9" />
              </div>
              {(form.type === "MX" || form.type === "SRV") && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Priority</label>
                  <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} placeholder="10" className="h-9" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {saving ? "Saving…" : "Save Record"}
              </Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 text-sm">{(error as any).message}</div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center">
            <Network size={36} className="text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No DNS records yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Click "Add Record" to create your first record.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium">Value</th>
                  <th className="px-4 py-2.5 text-left font-medium">TTL</th>
                  <th className="px-4 py-2.5 text-left font-medium">Priority</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-primary/10 text-primary">{r.type}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-foreground">{r.name}</td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground max-w-xs truncate">{r.value}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.ttl}s</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.priority ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId === r.id}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        {deletingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
