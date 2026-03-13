import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Plus, ToggleLeft, ToggleRight, Trash2, Loader2, TestTube, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface PaymentMethod { id: string; name: string; type: string; description: string | null; isActive: boolean; isSandbox: boolean; createdAt: string; }

const METHOD_ICONS: Record<string, string> = {
  stripe: "💳", paypal: "🅿️", bank_transfer: "🏦", crypto: "₿", manual: "✍️",
};

async function fetchMethods(): Promise<PaymentMethod[]> {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/admin/payment-methods", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function PaymentMethods() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: methods = [], isLoading } = useQuery({ queryKey: ["admin-payment-methods"], queryFn: fetchMethods });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "stripe", description: "", isSandbox: true });
  const [adding, setAdding] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/payment-methods/${id}/toggle`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-payment-methods"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("token");
      await fetch(`/api/admin/payment-methods/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-payment-methods"] }); toast({ title: "Payment method removed" }); },
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.type) return;
    setAdding(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      queryClient.invalidateQueries({ queryKey: ["admin-payment-methods"] });
      toast({ title: "Payment method added", description: form.name });
      setForm({ name: "", type: "stripe", description: "", isSandbox: true });
      setShowForm(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Payment Methods</h1>
          <p className="text-muted-foreground text-sm">Manage accepted payment options</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus size={18} /> Add Method
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-primary/20 rounded-2xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Add Payment Method</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Name *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Stripe Credit Card" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Type *</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="stripe">Stripe</option>
                  <option value="paypal">PayPal</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="crypto">Cryptocurrency</option>
                  <option value="manual">Manual / Other</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Description</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Pay securely with Visa, Mastercard, or Amex" />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="sandbox" checked={form.isSandbox} onChange={e => setForm(f => ({ ...f, isSandbox: e.target.checked }))} className="w-4 h-4 accent-primary" />
              <label htmlFor="sandbox" className="text-sm text-muted-foreground">Sandbox / Test mode</label>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={adding} className="bg-primary hover:bg-primary/90">
                {adding ? <Loader2 size={16} className="animate-spin mr-1" /> : null} Add Method
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </motion.div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-primary" size={32} /></div>
      ) : methods.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 bg-card border border-border rounded-2xl text-center">
          <CreditCard size={32} className="text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No payment methods yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map(m => (
            <div key={m.id} className={`bg-card border rounded-2xl p-5 flex items-center gap-4 transition-all ${m.isActive ? "border-border" : "border-border/40 opacity-60"}`}>
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-2xl">
                {METHOD_ICONS[m.type] ?? "💳"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground truncate">{m.name}</h3>
                  {m.isSandbox && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-full">
                      <TestTube size={10} /> Sandbox
                    </span>
                  )}
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${m.isActive ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-muted text-muted-foreground border border-border"}`}>
                    {m.isActive ? <CheckCircle size={10} /> : <XCircle size={10} />}
                    {m.isActive ? "Active" : "Disabled"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{m.description ?? m.type}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate(m.id)} className="gap-1.5 text-xs">
                  {m.isActive ? <ToggleRight size={14} className="text-green-400" /> : <ToggleLeft size={14} />}
                  {m.isActive ? "Disable" : "Enable"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remove this payment method?")) deleteMutation.mutate(m.id); }} className="text-destructive hover:text-destructive">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
