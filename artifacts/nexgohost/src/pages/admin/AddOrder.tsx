import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ShoppingCart, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Client { id: string; firstName: string; lastName: string; email: string; }
interface Package { id: string; name: string; price: string; }

export default function AddOrder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [clients, setClients] = useState<Client[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [form, setForm] = useState({
    clientId: "", type: "hosting", itemId: "", itemName: "", amount: "", notes: "", status: "pending",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}` };
    fetch("/api/admin/clients?limit=200", { headers }).then(r => r.json()).then(d => setClients(d.clients || []));
    fetch("/api/admin/packages", { headers }).then(r => r.json()).then(setPackages);
  }, []);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    setForm(f => {
      const next = { ...f, [field]: val };
      if (field === "itemId" && val) {
        const pkg = packages.find(p => p.id === val);
        if (pkg) { next.itemName = pkg.name; next.amount = String(pkg.price); }
      }
      if (field === "type" && val !== "hosting") { next.itemId = ""; }
      return next;
    });
    setErrors(err => ({ ...err, [field]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.clientId) e.clientId = "Client is required";
    if (!form.type) e.type = "Type is required";
    if (!form.itemName.trim()) e.itemName = "Item name is required";
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) < 0) e.amount = "Valid amount is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create order");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "Order created", description: `Order for ${form.itemName} has been placed.` });
      setLocation("/admin/orders");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/orders")} className="rounded-xl">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Create Order</h1>
          <p className="text-muted-foreground text-sm">Manually create an order for a client</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShoppingCart size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Order Details</h2>
              <p className="text-xs text-muted-foreground">Fill in all required fields</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Client *</label>
              <select value={form.clientId} onChange={set("clientId")} className={`w-full h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.clientId ? "border-destructive" : "border-input"}`}>
                <option value="">Select a client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.email})</option>)}
              </select>
              {errors.clientId && <p className="text-xs text-destructive">{errors.clientId}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Order Type *</label>
              <select value={form.type} onChange={set("type")} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="hosting">Hosting</option>
                <option value="domain">Domain</option>
                <option value="upgrade">Upgrade</option>
                <option value="renewal">Renewal</option>
              </select>
            </div>

            {form.type === "hosting" && packages.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Package</label>
                <select value={form.itemId} onChange={set("itemId")} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select a package...</option>
                  {packages.map(p => <option key={p.id} value={p.id}>{p.name} (${Number(p.price).toFixed(2)}/mo)</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Item Name *</label>
                <Input value={form.itemName} onChange={set("itemName")} placeholder="e.g. Business Hosting" className={errors.itemName ? "border-destructive" : ""} />
                {errors.itemName && <p className="text-xs text-destructive">{errors.itemName}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Amount ($) *</label>
                <Input type="number" step="0.01" min="0" value={form.amount} onChange={set("amount")} placeholder="9.99" className={errors.amount ? "border-destructive" : ""} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Initial Status</label>
              <select value={form.status} onChange={set("status")} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Notes</label>
              <textarea value={form.notes} onChange={set("notes")} rows={3}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                placeholder="Optional notes for this order..." />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1 bg-primary hover:bg-primary/90">
                {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <ShoppingCart size={18} className="mr-2" />}
                {loading ? "Creating..." : "Create Order"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setLocation("/admin/orders")}>Cancel</Button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
