import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layers, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ProductGroup {
  id: string; name: string; slug: string; description: string | null;
  isActive: boolean; sortOrder: number; createdAt: string;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const EMPTY = { name: "", slug: "", description: "" };

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function ProductGroups() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data: groups = [], isLoading } = useQuery<ProductGroup[]>({
    queryKey: ["admin-product-groups"],
    queryFn: () => apiFetch("/api/admin/product-groups"),
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm(f => ({
      ...f,
      [field]: value,
      ...(field === "name" && !editId ? { slug: slugify(value) } : {}),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug) {
      toast({ title: "Error", description: "Name and slug are required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      if (editId) {
        await apiFetch(`/api/admin/product-groups/${editId}`, { method: "PUT", body: JSON.stringify(form) });
        toast({ title: "Group updated" });
      } else {
        await apiFetch("/api/admin/product-groups", { method: "POST", body: JSON.stringify(form) });
        toast({ title: "Group created", description: `"${form.name}" added.` });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-product-groups"] });
      setForm(EMPTY); setShowForm(false); setEditId(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleEdit = (g: ProductGroup) => {
    setEditId(g.id);
    setForm({ name: g.name, slug: g.slug, description: g.description || "" });
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete group "${name}"?`)) return;
    try {
      await apiFetch(`/api/admin/product-groups/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["admin-product-groups"] });
      toast({ title: "Group deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleToggle = async (g: ProductGroup) => {
    try {
      await apiFetch(`/api/admin/product-groups/${g.id}`, { method: "PUT", body: JSON.stringify({ isActive: !g.isActive }) });
      queryClient.invalidateQueries({ queryKey: ["admin-product-groups"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Product Groups</h1>
          <p className="text-muted-foreground text-sm">Organize hosting plans into categories</p>
        </div>
        <Button onClick={() => { setEditId(null); setForm(EMPTY); setShowForm(true); }} className="bg-primary hover:bg-primary/90">
          <Plus size={16} className="mr-2" /> Add Group
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Layers size={18} className="text-primary" />
            </div>
            <h2 className="font-semibold">{editId ? "Edit Group" : "Add Product Group"}</h2>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Group Name *</label>
                <Input value={form.name} onChange={set("name")} placeholder="Shared Hosting" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Slug *</label>
                <Input value={form.slug} onChange={set("slug")} placeholder="shared-hosting" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Description</label>
              <textarea
                value={form.description}
                onChange={set("description")}
                rows={2}
                placeholder="Brief description..."
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
                {saving && <Loader2 size={16} className="animate-spin mr-2" />}
                {editId ? "Save Changes" : "Create Group"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY); }}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-secondary/50 border-b border-border">
              <th className="p-4 text-sm font-medium text-muted-foreground">Name</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Slug</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Description</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="p-4 text-sm font-medium text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></td></tr>
            ) : groups.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No product groups yet. Create your first group.</td></tr>
            ) : groups.map(g => (
              <tr key={g.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                <td className="p-4 font-medium text-foreground">{g.name}</td>
                <td className="p-4 text-sm font-mono text-muted-foreground">{g.slug}</td>
                <td className="p-4 text-sm text-muted-foreground max-w-xs truncate">{g.description || "—"}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                    g.isActive ? "bg-[rgba(3,218,198,0.10)] text-[#03DAC6] border-[rgba(3,218,198,0.30)]" : "bg-secondary text-muted-foreground border-border"
                  }`}>{g.isActive ? "Active" : "Inactive"}</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleToggle(g)}>
                      {g.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} className="text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEdit(g)}>
                      <Pencil size={15} className="text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleDelete(g.id, g.name)}>
                      <Trash2 size={15} className="text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Example groups:</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {["Shared Hosting", "WordPress Hosting", "Reseller Hosting", "VPS Hosting", "Dedicated Servers"].map(g => (
            <button key={g} onClick={() => { setForm({ name: g, slug: slugify(g), description: "" }); setShowForm(true); setEditId(null); }}
              className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-xs rounded-full hover:bg-primary/20 transition-colors">
              + {g}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
