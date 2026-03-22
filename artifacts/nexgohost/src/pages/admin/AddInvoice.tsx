import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { FileText, ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { useCurrency } from "@/context/CurrencyProvider";

interface Client { id: string; firstName: string; lastName: string; email: string; }
interface InvoiceItem { description: string; quantity: number; unitPrice: number; total: number; }

export default function AddInvoice() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const queryClient = useQueryClient();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const [tax, setTax] = useState("0");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/admin/clients?limit=200", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setClients(d.clients || []));
  }, []);

  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    setItems(items => items.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        updated.total = Number(updated.quantity) * Number(updated.unitPrice);
      }
      return updated;
    }));
  };

  const addItem = () => setItems(i => [...i, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const removeItem = (idx: number) => setItems(i => i.filter((_, j) => j !== idx));

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const taxAmt = (subtotal * Number(tax)) / 100;
  const grandTotal = subtotal + taxAmt;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) { toast({ title: "Error", description: "Please select a client", variant: "destructive" }); return; }
    if (items.some(i => !i.description.trim())) { toast({ title: "Error", description: "All items need a description", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clientId, items, dueDate, tax: taxAmt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invoice");
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      toast({ title: "Invoice created", description: `Invoice ${data.invoiceNumber} has been created.` });
      setLocation("/admin/invoices");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/invoices")} className="rounded-xl">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Create Invoice</h1>
          <p className="text-muted-foreground text-sm">Generate a new invoice for a client</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Invoice Details</h2>
                <p className="text-xs text-muted-foreground">Invoice number is auto-generated</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Client *</label>
                  <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Select a client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.email})</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Due Date *</label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground/80">Invoice Items</label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 rounded-lg text-xs">
                    <Plus size={13} className="mr-1" /> Add Item
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
                    <span className="col-span-5">Description</span>
                    <span className="col-span-2 text-center">Qty</span>
                    <span className="col-span-2 text-right">Unit Price</span>
                    <span className="col-span-2 text-right">Total</span>
                    <span className="col-span-1" />
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <Input className="col-span-5 h-9 text-sm" value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="Service description" />
                      <Input className="col-span-2 h-9 text-sm text-center" type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} />
                      <Input className="col-span-2 h-9 text-sm text-right" type="number" step="0.01" min="0" value={item.unitPrice} onChange={e => updateItem(idx, "unitPrice", Number(e.target.value))} />
                      <div className="col-span-2 text-right text-sm font-medium text-foreground/80 pr-1">{formatPrice(item.total)}</div>
                      <Button type="button" variant="ghost" size="icon" className="col-span-1 h-8 w-8 rounded-lg" onClick={() => removeItem(idx)} disabled={items.length === 1}>
                        <Trash2 size={13} className="text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Tax (%)</label>
                <Input type="number" step="0.01" min="0" max="100" value={tax} onChange={e => setTax(e.target.value)} className="w-28" placeholder="0" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
              </div>
              {taxAmt > 0 && <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tax ({tax}%)</span><span>{formatPrice(taxAmt)}</span>
              </div>}
              <div className="flex justify-between font-semibold text-foreground pt-2 border-t border-border/50">
                <span>Total</span><span className="text-primary">{formatPrice(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={loading} className="flex-1 bg-primary hover:bg-primary/90">
              {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <FileText size={18} className="mr-2" />}
              {loading ? "Creating..." : "Create Invoice"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setLocation("/admin/invoices")}>Cancel</Button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
