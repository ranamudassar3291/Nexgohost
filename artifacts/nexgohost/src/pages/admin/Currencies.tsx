import { useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, Plus, Pencil, Trash2, Star, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: string;
  isDefault: boolean;
  isActive: boolean;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const EMPTY = { code: "", name: "", symbol: "", exchangeRate: "1.0000" };

export default function Currencies() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: currencies = [], isLoading } = useQuery<Currency[]>({
    queryKey: ["admin-currencies"],
    queryFn: () => apiFetch("/api/admin/currencies"),
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name || !form.symbol) {
      toast({ title: "Error", description: "Code, name, and symbol are required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      if (editId) {
        await apiFetch(`/api/admin/currencies/${editId}`, { method: "PUT", body: JSON.stringify({ ...form, isDefault }) });
        toast({ title: "Currency updated" });
      } else {
        await apiFetch("/api/admin/currencies", { method: "POST", body: JSON.stringify({ ...form, isDefault }) });
        toast({ title: "Currency added", description: `${form.code} is now available.` });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-currencies"] });
      setForm(EMPTY); setShowForm(false); setEditId(null); setIsDefault(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleEdit = (c: Currency) => {
    setEditId(c.id);
    setForm({ code: c.code, name: c.name, symbol: c.symbol, exchangeRate: c.exchangeRate });
    setIsDefault(c.isDefault);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this currency?")) return;
    try {
      await apiFetch(`/api/admin/currencies/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["admin-currencies"] });
      toast({ title: "Currency deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRefreshRates = async () => {
    setRefreshing(true);
    try {
      const data = await apiFetch("/api/admin/currencies/refresh-rates", { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["admin-currencies"] });
      const msg = data.errors?.length
        ? `Updated ${data.updated} rates. Warnings: ${data.errors.join(", ")}`
        : `Successfully updated ${data.updated} exchange rates from open.er-api.com`;
      toast({ title: "Exchange rates refreshed", description: msg });
    } catch (err: any) {
      toast({ title: "Refresh failed", description: err.message, variant: "destructive" });
    } finally { setRefreshing(false); }
  };

  const setDefault = async (c: Currency) => {
    try {
      await apiFetch(`/api/admin/currencies/${c.id}`, { method: "PUT", body: JSON.stringify({ isDefault: true }) });
      queryClient.invalidateQueries({ queryKey: ["admin-currencies"] });
      toast({ title: `${c.code} set as default currency` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Currencies</h1>
          <p className="text-muted-foreground text-sm">Manage supported currencies and exchange rates</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefreshRates} disabled={refreshing}
            className="gap-2 border-green-500/30 text-green-400 hover:bg-green-500/10">
            {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {refreshing ? "Refreshing..." : "Refresh Rates"}
          </Button>
          <Button onClick={() => { setEditId(null); setForm(EMPTY); setIsDefault(false); setShowForm(true); }} className="bg-primary hover:bg-primary/90">
            <Plus size={16} className="mr-2" /> Add Currency
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-6 max-w-xl">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign size={18} className="text-primary" />
            </div>
            <h2 className="font-semibold">{editId ? "Edit Currency" : "Add Currency"}</h2>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Code (e.g. PKR)</label>
                <Input value={form.code} onChange={set("code")} placeholder="USD" maxLength={3} className="uppercase" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Symbol</label>
                <Input value={form.symbol} onChange={set("symbol")} placeholder="$" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Currency Name</label>
              <Input value={form.name} onChange={set("name")} placeholder="US Dollar" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Exchange Rate (vs USD)</label>
              <Input type="number" step="0.0001" min="0" value={form.exchangeRate} onChange={set("exchangeRate")} placeholder="1.0000" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="rounded" />
              <span className="text-sm text-foreground/80">Set as default currency</span>
            </label>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
                {saving && <Loader2 size={16} className="animate-spin mr-2" />}
                {editId ? "Save Changes" : "Add Currency"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-secondary/50 border-b border-border">
              <th className="p-4 text-sm font-medium text-muted-foreground">Code</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Name</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Symbol</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Exchange Rate</th>
              <th className="p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="p-4 text-sm font-medium text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></td></tr>
            ) : currencies.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No currencies configured.</td></tr>
            ) : currencies.map(c => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{c.code}</span>
                    {c.isDefault && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs rounded-full"><Star size={10} />Default</span>}
                  </div>
                </td>
                <td className="p-4 text-sm">{c.name}</td>
                <td className="p-4 text-sm font-semibold">{c.symbol}</td>
                <td className="p-4 text-sm">{Number(c.exchangeRate).toFixed(4)}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                    c.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-secondary text-muted-foreground border-border"
                  }`}>{c.isActive ? "Active" : "Inactive"}</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1 justify-end">
                    {!c.isDefault && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setDefault(c)} title="Set as default">
                        <Star size={14} className="text-yellow-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEdit(c)}>
                      <Pencil size={15} className="text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleDelete(c.id)}>
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
