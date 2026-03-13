import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2, Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface DomainExtension {
  id: string;
  extension: string;
  registerPrice: string;
  renewalPrice: string;
  transferPrice: string;
  privacyEnabled: boolean;
  status: "active" | "inactive";
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const EMPTY = { extension: "", registerPrice: "", renewalPrice: "", transferPrice: "", privacyEnabled: true };

export default function DomainExtensions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data: extensions = [], isLoading } = useQuery<DomainExtension[]>({
    queryKey: ["admin-domain-extensions"],
    queryFn: () => apiFetch("/api/admin/domain-extensions"),
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.extension || !form.registerPrice || !form.renewalPrice || !form.transferPrice) {
      toast({ title: "Error", description: "All price fields are required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      if (editId) {
        await apiFetch(`/api/admin/domain-extensions/${editId}`, { method: "PUT", body: JSON.stringify(form) });
        toast({ title: "Extension updated" });
      } else {
        await apiFetch("/api/admin/domain-extensions", { method: "POST", body: JSON.stringify(form) });
        toast({ title: "Extension added", description: `${form.extension} is now available.` });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-domain-extensions"] });
      setForm(EMPTY); setShowForm(false); setEditId(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleEdit = (ext: DomainExtension) => {
    setEditId(ext.id);
    setForm({ extension: ext.extension, registerPrice: ext.registerPrice, renewalPrice: ext.renewalPrice, transferPrice: ext.transferPrice, privacyEnabled: ext.privacyEnabled });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this extension?")) return;
    try {
      await apiFetch(`/api/admin/domain-extensions/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["admin-domain-extensions"] });
      toast({ title: "Extension deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleToggle = async (ext: DomainExtension, field: "status" | "privacyEnabled") => {
    try {
      const body = field === "status"
        ? { status: ext.status === "active" ? "inactive" : "active" }
        : { privacyEnabled: !ext.privacyEnabled };
      await apiFetch(`/api/admin/domain-extensions/${ext.id}`, { method: "PUT", body: JSON.stringify(body) });
      queryClient.invalidateQueries({ queryKey: ["admin-domain-extensions"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Domain Extensions</h1>
          <p className="text-muted-foreground text-sm">Manage TLD pricing (.com, .net, .org, .pk…)</p>
        </div>
        <Button onClick={() => { setEditId(null); setForm(EMPTY); setShowForm(true); }} className="bg-primary hover:bg-primary/90">
          <Plus size={16} className="mr-2" /> Add Extension
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Globe size={18} className="text-primary" />
            </div>
            <h2 className="font-semibold">{editId ? "Edit Extension" : "Add Domain Extension"}</h2>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Extension (e.g. .com)</label>
              <Input value={form.extension} onChange={set("extension")} placeholder=".com" disabled={!!editId} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { field: "registerPrice", label: "Register Price ($)" },
                { field: "renewalPrice", label: "Renewal Price ($)" },
                { field: "transferPrice", label: "Transfer Price ($)" },
              ].map(({ field, label }) => (
                <div key={field} className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">{label}</label>
                  <Input type="number" step="0.01" min="0" value={form[field as keyof typeof form] as string} onChange={set(field)} placeholder="12.99" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <Shield size={16} className="text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Domain Privacy Protection</p>
                <p className="text-xs text-muted-foreground">Free WHOIS privacy (like Hostinger)</p>
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, privacyEnabled: !f.privacyEnabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.privacyEnabled ? "bg-primary" : "bg-muted"}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.privacyEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
                {saving && <Loader2 size={16} className="animate-spin mr-2" />}
                {editId ? "Save Changes" : "Add Extension"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY); }}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-secondary/50 border-b border-border">
              <th className="p-4 text-sm font-medium text-muted-foreground">Extension</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Register</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Renewal</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Transfer</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Privacy</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="p-4 text-sm font-medium text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></td></tr>
            ) : extensions.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No extensions added yet.</td></tr>
            ) : extensions.map(ext => (
              <tr key={ext.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                <td className="p-4 font-mono font-semibold text-primary">{ext.extension}</td>
                <td className="p-4 text-sm">${Number(ext.registerPrice).toFixed(2)}/yr</td>
                <td className="p-4 text-sm">${Number(ext.renewalPrice).toFixed(2)}/yr</td>
                <td className="p-4 text-sm">${Number(ext.transferPrice).toFixed(2)}</td>
                <td className="p-4">
                  <button onClick={() => handleToggle(ext, "privacyEnabled")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${ext.privacyEnabled ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"}`}>
                    {ext.privacyEnabled ? <Shield size={11} /> : <ShieldOff size={11} />}
                    {ext.privacyEnabled ? "Free" : "Off"}
                  </button>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                    ext.status === "active" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-secondary text-muted-foreground border-border"
                  }`}>{ext.status}</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleToggle(ext, "status")}>
                      {ext.status === "active" ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} className="text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEdit(ext)}>
                      <Pencil size={15} className="text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleDelete(ext.id)}>
                      <Trash2 size={15} className="text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
