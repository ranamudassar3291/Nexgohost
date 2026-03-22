import { useState } from "react";
import { motion } from "framer-motion";
import { Tag, Plus, ToggleLeft, ToggleRight, Trash2, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface PromoCode {
  id: string; code: string; description: string | null; discountPercent: number;
  isActive: boolean; usageLimit: number | null; usedCount: number; expiresAt: string | null;
  applicableTo: string; createdAt: string;
}

async function fetchCodes(): Promise<PromoCode[]> {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/admin/promo-codes", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function PromoCodes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: codes = [], isLoading } = useQuery({ queryKey: ["admin-promo-codes"], queryFn: fetchCodes });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", description: "", discountPercent: "", usageLimit: "", expiresAt: "", applicableTo: "all" });
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("token");
      await fetch(`/api/admin/promo-codes/${id}/toggle`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("token");
      await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] }); toast({ title: "Promo code deleted" }); },
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.code.trim() || !form.discountPercent) { setFormError("Code and discount % are required"); return; }
    const pct = parseInt(form.discountPercent);
    if (isNaN(pct) || pct < 1 || pct > 100) { setFormError("Discount must be between 1 and 100"); return; }
    setAdding(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          code: form.code.toUpperCase(),
          description: form.description || undefined,
          discountPercent: pct,
          usageLimit: form.usageLimit ? parseInt(form.usageLimit) : undefined,
          expiresAt: form.expiresAt || undefined,
          applicableTo: form.applicableTo || "all",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
      toast({ title: "Promo code created", description: data.code });
      setForm({ code: "", description: "", discountPercent: "", usageLimit: "", expiresAt: "", applicableTo: "all" });
      setShowForm(false);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Promo Codes</h1>
          <p className="text-muted-foreground text-sm">{codes.length} code{codes.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus size={18} /> Create Code
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-primary/20 rounded-2xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Create Promo Code</h2>
          {formError && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
              <AlertCircle size={14} />{formError}
            </div>
          )}
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Code *</label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="SAVE20" className="font-mono uppercase" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Discount % *</label>
                <Input type="number" min="1" max="100" value={form.discountPercent} onChange={e => setForm(f => ({ ...f, discountPercent: e.target.value }))} placeholder="20" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Description</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Summer Sale" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Applies To</label>
                <select value={form.applicableTo} onChange={e => setForm(f => ({ ...f, applicableTo: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none">
                  <option value="all">All Services</option>
                  <option value="hosting">Hosting Only</option>
                  <option value="domain">Domains Only</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Usage Limit</label>
                <Input type="number" min="1" value={form.usageLimit} onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))} placeholder="Unlimited" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Expiry Date</label>
                <Input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} min={new Date().toISOString().split("T")[0]} />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={adding} className="bg-primary hover:bg-primary/90">
                {adding ? <Loader2 size={16} className="animate-spin mr-1" /> : null} Create Code
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </motion.div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-primary" size={32} /></div>
      ) : codes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 bg-card border border-border rounded-2xl text-center">
          <Tag size={32} className="text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No promo codes yet.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-border/50 bg-secondary/30">
              {["Code", "Discount", "Applies To", "Usage", "Expires", "Status", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {codes.map((c, i) => (
                <tr key={c.id} className={`border-b border-border/30 hover:bg-secondary/20 transition-colors ${i === codes.length - 1 ? "border-0" : ""}`}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-mono font-bold text-primary text-sm">{c.code}</p>
                      {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm font-semibold">
                      -{c.discountPercent}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${
                      c.applicableTo === "hosting" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                      c.applicableTo === "domain"  ? "bg-purple-500/10 border-purple-500/20 text-purple-400" :
                      "bg-secondary border-border text-muted-foreground"
                    }`}>
                      {c.applicableTo === "hosting" ? "Hosting" : c.applicableTo === "domain" ? "Domains" : "All"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : " / ∞"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full w-fit ${c.isActive ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-muted text-muted-foreground border border-border"}`}>
                      {c.isActive ? <CheckCircle size={10} /> : <XCircle size={10} />}
                      {c.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate(c.id)} className="text-xs h-7 px-2">
                        {c.isActive ? <ToggleRight size={13} className="text-green-400" /> : <ToggleLeft size={13} />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this promo code?")) deleteMutation.mutate(c.id); }} className="text-destructive hover:text-destructive h-7 px-2">
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
