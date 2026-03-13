import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Server, Plus, Pencil, Trash2, CheckCircle, XCircle, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ServerRecord {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string | null;
  type: "cpanel" | "directadmin" | "plesk" | "none";
  apiUsername: string | null;
  apiPort: number | null;
  ns1: string | null;
  ns2: string | null;
  maxAccounts: number | null;
  status: "active" | "inactive" | "maintenance";
  isDefault: boolean;
  createdAt: string;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const EMPTY = {
  name: "", hostname: "", ipAddress: "", type: "cpanel", apiUsername: "", apiToken: "",
  apiPort: "2087", ns1: "", ns2: "", maxAccounts: "500",
};

export default function Servers() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const { data: servers = [], isLoading } = useQuery<ServerRecord[]>({
    queryKey: ["admin-servers"],
    queryFn: () => apiFetch("/api/admin/servers"),
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.hostname) {
      toast({ title: "Error", description: "Server name and hostname are required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      if (editId) {
        await apiFetch(`/api/admin/servers/${editId}`, { method: "PUT", body: JSON.stringify({ ...form, isDefault }) });
        toast({ title: "Server updated" });
      } else {
        await apiFetch("/api/admin/servers", { method: "POST", body: JSON.stringify({ ...form, isDefault }) });
        toast({ title: "Server added", description: `${form.name} has been configured.` });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-servers"] });
      setForm(EMPTY); setShowForm(false); setEditId(null); setIsDefault(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const result = await apiFetch(`/api/admin/servers/${id}/test`, { method: "POST" });
      toast({ title: "Connection test", description: result.message });
    } catch (err: any) {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    } finally { setTesting(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this server?")) return;
    try {
      await apiFetch(`/api/admin/servers/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["admin-servers"] });
      toast({ title: "Server deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    inactive: "bg-secondary text-muted-foreground border-border",
    maintenance: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  };

  const typeLabels: Record<string, string> = {
    cpanel: "cPanel", directadmin: "DirectAdmin", plesk: "Plesk", none: "None",
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Servers</h1>
          <p className="text-muted-foreground text-sm">Manage hosting servers and control panel integrations</p>
        </div>
        <Button onClick={() => { setEditId(null); setForm(EMPTY); setIsDefault(false); setShowForm(true); }} className="bg-primary hover:bg-primary/90">
          <Plus size={16} className="mr-2" /> Add Server
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Server size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">{editId ? "Edit Server" : "Add Server"}</h2>
              <p className="text-xs text-muted-foreground">Configure server connection and API credentials</p>
            </div>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Server Name *</label>
                <Input value={form.name} onChange={set("name")} placeholder="US Server 01" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Hostname *</label>
                <Input value={form.hostname} onChange={set("hostname")} placeholder="server01.nexgohost.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">IP Address</label>
                <Input value={form.ipAddress} onChange={set("ipAddress")} placeholder="192.168.1.1" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Module Type</label>
                <select value={form.type} onChange={set("type")} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="cpanel">cPanel</option>
                  <option value="directadmin">DirectAdmin</option>
                  <option value="plesk">Plesk</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>

            <div className="border border-border/50 rounded-xl p-4 space-y-3 bg-secondary/20">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">API Credentials</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">API Username</label>
                  <Input value={form.apiUsername} onChange={set("apiUsername")} placeholder="root" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">API Token</label>
                  <Input type="password" value={form.apiToken} onChange={set("apiToken")} placeholder="••••••••••••" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">API Port</label>
                <Input type="number" value={form.apiPort} onChange={set("apiPort")} placeholder="2087" className="w-32" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Nameserver 1</label>
                <Input value={form.ns1} onChange={set("ns1")} placeholder="ns1.nexgohost.com" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Nameserver 2</label>
                <Input value={form.ns2} onChange={set("ns2")} placeholder="ns2.nexgohost.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Max Accounts</label>
              <Input type="number" value={form.maxAccounts} onChange={set("maxAccounts")} placeholder="500" className="w-32" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="rounded" />
              <span className="text-sm text-foreground/80">Set as default server</span>
            </label>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
                {saving && <Loader2 size={16} className="animate-spin mr-2" />}
                {editId ? "Save Changes" : "Add Server"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {servers.length === 0 && !isLoading && !showForm ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
          <Server size={40} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-foreground mb-2">No servers configured</h3>
          <p className="text-muted-foreground text-sm mb-4">Add a hosting server to start provisioning accounts.</p>
          <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90"><Plus size={16} className="mr-2" />Add First Server</Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {servers.map(s => (
            <div key={s.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.status === "active" ? "bg-primary/10" : "bg-secondary"}`}>
                    <Server size={22} className={s.status === "active" ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{s.name}</h3>
                      {s.isDefault && <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full">Default</span>}
                      <span className={`text-xs px-2 py-0.5 border rounded-full ${statusColors[s.status]}`}>{s.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{s.hostname}{s.ipAddress ? ` · ${s.ipAddress}` : ""}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{typeLabels[s.type]}</span>
                      {s.ns1 && <span className="text-xs text-muted-foreground">NS: {s.ns1}</span>}
                      {s.maxAccounts && <span className="text-xs text-muted-foreground">Max: {s.maxAccounts} accounts</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => handleTest(s.id)} disabled={testing === s.id}>
                    {testing === s.id ? <Loader2 size={13} className="animate-spin mr-1" /> : <Shield size={13} className="mr-1" />}
                    Test
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => {
                    setEditId(s.id);
                    setForm({ name: s.name, hostname: s.hostname, ipAddress: s.ipAddress || "", type: s.type, apiUsername: s.apiUsername || "", apiToken: "", apiPort: String(s.apiPort || 2087), ns1: s.ns1 || "", ns2: s.ns2 || "", maxAccounts: String(s.maxAccounts || 500) });
                    setIsDefault(s.isDefault);
                    setShowForm(true);
                  }}><Pencil size={15} className="text-muted-foreground" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleDelete(s.id)}>
                    <Trash2 size={15} className="text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
