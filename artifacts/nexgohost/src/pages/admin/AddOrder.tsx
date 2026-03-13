import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, ArrowLeft, Loader2, CheckCircle, AlertCircle,
  FileText, Zap, DollarSign, Calendar, User, Package, RefreshCw,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Client { id: string; firstName: string; lastName: string; email: string; }
interface HostingPackage {
  id: string; name: string; price: number; yearlyPrice: number | null;
  module: string; modulePlanId: string | null; modulePlanName: string | null;
  diskSpace: string; bandwidth: string;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const MODULE_BADGES: Record<string, { label: string; color: string; icon: string }> = {
  cpanel:      { label: "cPanel/WHM", color: "bg-orange-500/10 border-orange-500/20 text-orange-400",   icon: "⚡" },
  "20i":       { label: "20i",        color: "bg-blue-500/10 border-blue-500/20 text-blue-400",         icon: "🔵" },
  directadmin: { label: "DirectAdmin",color: "bg-amber-500/10 border-amber-500/20 text-amber-400",     icon: "🟠" },
  plesk:       { label: "Plesk",      color: "bg-purple-500/10 border-purple-500/20 text-purple-400",   icon: "🟣" },
  none:        { label: "None",       color: "bg-secondary/50 border-border text-muted-foreground",     icon: "—" },
};

export default function AddOrder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [clients, setClients] = useState<Client[]>([]);
  const [packages, setPackages] = useState<HostingPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    clientId: "",
    type: "hosting",
    itemId: "",
    itemName: "",
    domain: "",
    amount: "",
    billingCycle: "monthly",
    dueDate: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split("T")[0]; })(),
    paymentStatus: "unpaid",
    moduleType: "none",
    modulePlanId: "",
    modulePlanName: "",
    notes: "",
    status: "pending",
  });

  const [selectedPackage, setSelectedPackage] = useState<HostingPackage | null>(null);
  const [result, setResult] = useState<{ order: any; invoice: any } | null>(null);

  useEffect(() => {
    apiFetch("/api/admin/clients?limit=200").then(d => setClients(d.clients || [])).catch(() => {});
    apiFetch("/api/admin/packages").then(d => setPackages(d || [])).catch(() => {});
  }, []);

  const handlePackageChange = (pkgId: string) => {
    const pkg = packages.find(p => p.id === pkgId);
    if (!pkg) {
      setSelectedPackage(null);
      setForm(f => ({ ...f, itemId: "", itemName: "", amount: "", moduleType: "none", modulePlanId: "", modulePlanName: "" }));
      return;
    }
    setSelectedPackage(pkg);
    const price = form.billingCycle === "yearly" && pkg.yearlyPrice ? pkg.yearlyPrice : pkg.price;
    setForm(f => ({
      ...f,
      itemId: pkg.id,
      itemName: pkg.name,
      amount: String(price),
      moduleType: pkg.module || "none",
      modulePlanId: pkg.modulePlanId || "",
      modulePlanName: pkg.modulePlanName || "",
    }));
    setErrors(e => ({ ...e, itemId: "", amount: "" }));
  };

  const handleBillingCycleChange = (cycle: string) => {
    setForm(f => {
      const nextForm = { ...f, billingCycle: cycle };
      if (selectedPackage) {
        nextForm.amount = String(cycle === "yearly" && selectedPackage.yearlyPrice ? selectedPackage.yearlyPrice : selectedPackage.price);
      }
      return nextForm;
    });
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(err => ({ ...err, [field]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.clientId) e.clientId = "Client is required";
    if (!form.itemName.trim()) e.itemName = "Item name is required";
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) < 0) e.amount = "Valid amount is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (approve = false, genInvoice = false) => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        clientId: form.clientId,
        type: form.type,
        itemId: form.itemId || null,
        itemName: form.itemName,
        domain: form.domain || null,
        amount: Number(form.amount),
        billingCycle: form.billingCycle,
        dueDate: form.dueDate || null,
        moduleType: form.moduleType || "none",
        modulePlanId: form.modulePlanId || null,
        modulePlanName: form.modulePlanName || null,
        paymentStatus: form.paymentStatus,
        notes: form.notes || null,
        status: approve ? "approved" : form.status,
        generateInvoice: genInvoice || approve,
      };
      const data = await apiFetch("/api/admin/orders", { method: "POST", body: JSON.stringify(payload) });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setResult(data);
      toast({
        title: approve ? "Order approved & invoice generated" : genInvoice ? "Order created with invoice" : "Order created",
        description: data.invoice ? `Invoice ${data.invoice.invoiceNumber} created` : `Order saved successfully`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  if (result) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="max-w-2xl">
          <div className="bg-card border border-emerald-500/20 rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground">Order Created!</h2>
            <p className="text-muted-foreground">Order for <strong>{result.order?.itemName}</strong> has been saved successfully.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left mt-4">
              <div className="bg-secondary/50 border border-border rounded-xl p-4 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Order</p>
                <p className="font-semibold text-foreground">{result.order?.itemName}</p>
                <p className="text-sm text-muted-foreground">${Number(result.order?.amount || 0).toFixed(2)} · {result.order?.billingCycle}</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${result.order?.status === "approved" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}>
                  {result.order?.status}
                </span>
              </div>
              {result.invoice && (
                <div className="bg-secondary/50 border border-border rounded-xl p-4 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Invoice</p>
                  <p className="font-mono font-semibold text-primary">{result.invoice?.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">${Number(result.invoice?.total || 0).toFixed(2)}</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${result.invoice?.status === "paid" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}>
                    {result.invoice?.status}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={() => setLocation("/admin/orders")} className="bg-primary hover:bg-primary/90">
                <ShoppingCart size={16} className="mr-2" /> View Orders
              </Button>
              {result.invoice && (
                <Button variant="outline" onClick={() => setLocation("/admin/invoices")}>
                  <FileText size={16} className="mr-2" /> View Invoices
                </Button>
              )}
              <Button variant="outline" onClick={() => { setResult(null); setForm(f => ({ ...f, itemId: "", itemName: "", amount: "", notes: "" })); setSelectedPackage(null); }}>
                Create Another
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const modBadge = MODULE_BADGES[form.moduleType] || MODULE_BADGES.none;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/orders")} className="rounded-xl">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Create Order</h1>
          <p className="text-muted-foreground text-sm">Manually create a client order with module provisioning</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-5">
        {/* Client & Type */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <User size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Client & Order Type</h2>
              <p className="text-xs text-muted-foreground">Who this order is for and what type it is</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Client *</label>
            <select value={form.clientId} onChange={set("clientId")}
              className={`w-full h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.clientId ? "border-destructive" : "border-input"}`}>
              <option value="">Select a client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.email}</option>)}
            </select>
            {errors.clientId && <p className="text-xs text-destructive">{errors.clientId}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Order Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {["hosting", "domain", "upgrade", "renewal"].map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t, itemId: "", itemName: "", amount: "" }))}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium capitalize transition-all ${form.type === t ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Package / Item Selection */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Package size={20} className="text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">
                {form.type === "hosting" ? "Package & Module" : "Item Details"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {form.type === "hosting" ? "Select a package — module info auto-fills from package settings" : "Enter order item details"}
              </p>
            </div>
          </div>

          {form.type === "hosting" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Hosting Package</label>
              <select value={form.itemId} onChange={e => handlePackageChange(e.target.value)}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Select a package…</option>
                {packages.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ${Number(p.price).toFixed(2)}/mo{p.yearlyPrice ? ` | $${Number(p.yearlyPrice).toFixed(2)}/yr` : ""}
                    {p.module && p.module !== "none" ? ` [${p.module}]` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Module info from package */}
          <AnimatePresence>
            {selectedPackage && form.moduleType !== "none" && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-wrap items-center gap-2 px-4 py-3 bg-secondary/30 border border-border rounded-xl">
                <Zap size={14} className="text-primary" />
                <span className="text-sm font-medium text-foreground">Module:</span>
                <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${modBadge.color}`}>
                  {modBadge.icon} {modBadge.label}
                </span>
                {form.modulePlanName && (
                  <>
                    <span className="text-muted-foreground text-xs">Plan:</span>
                    <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary text-xs rounded-md font-medium">{form.modulePlanName}</span>
                  </>
                )}
                <span className="ml-auto text-xs text-muted-foreground">Auto-provisioning will be triggered on approval</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Domain field for domain orders or optional for hosting */}
          {(form.type === "domain" || form.type === "hosting") && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">
                {form.type === "domain" ? "Domain Name *" : "Domain (optional)"}
              </label>
              <div className="relative">
                <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={form.domain} onChange={set("domain")} placeholder="example.com" className="pl-9" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Item Name *</label>
            <Input value={form.itemName} onChange={set("itemName")} placeholder="e.g. Business Hosting Plan"
              className={errors.itemName ? "border-destructive" : ""} />
            {errors.itemName && <p className="text-xs text-destructive">{errors.itemName}</p>}
          </div>
        </div>

        {/* Billing & Pricing */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <DollarSign size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Billing & Pricing</h2>
              <p className="text-xs text-muted-foreground">Cycle, amount, and payment status</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Billing Cycle</label>
            <div className="grid grid-cols-2 gap-2">
              {["monthly", "yearly"].map(cycle => (
                <button key={cycle} type="button" onClick={() => handleBillingCycleChange(cycle)}
                  className={`py-2.5 rounded-xl border text-sm font-medium capitalize transition-all ${form.billingCycle === cycle ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {cycle}
                  {selectedPackage && (
                    <span className="ml-2 text-xs opacity-70">
                      ${cycle === "yearly" && selectedPackage.yearlyPrice ? Number(selectedPackage.yearlyPrice).toFixed(2) : Number(selectedPackage.price).toFixed(2)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Amount ($) *</label>
              <Input type="number" step="0.01" min="0" value={form.amount} onChange={set("amount")} placeholder="9.99"
                className={errors.amount ? "border-destructive" : ""} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Payment Status</label>
              <select value={form.paymentStatus} onChange={set("paymentStatus")}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
        </div>

        {/* Schedule & Notes */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Calendar size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Schedule & Notes</h2>
              <p className="text-xs text-muted-foreground">Due date and additional information</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Due Date</label>
              <Input type="date" value={form.dueDate} onChange={set("dueDate")} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Initial Status</label>
              <select value={form.status} onChange={set("status")}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Order Notes</label>
            <textarea value={form.notes} onChange={set("notes")} rows={3}
              placeholder="Optional internal notes for this order…"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold text-foreground mb-4">Save Order</h2>

          {/* Approve & Generate Invoice (primary action) */}
          <Button type="button" onClick={() => handleSave(true, true)} disabled={loading}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20">
            {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <CheckCircle size={18} className="mr-2" />}
            Approve Order & Generate Invoice
          </Button>
          <p className="text-xs text-center text-muted-foreground">Activates service + generates invoice{form.paymentStatus === "paid" ? " (marked paid)" : " (unpaid)"}</p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => handleSave(false, true)} disabled={loading} className="h-11">
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <FileText size={16} className="mr-2" />}
              Save + Generate Invoice
            </Button>
            <Button type="button" variant="outline" onClick={() => handleSave(false, false)} disabled={loading} className="h-11">
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <ShoppingCart size={16} className="mr-2" />}
              Save Order Only
            </Button>
          </div>

          <Button type="button" variant="ghost" onClick={() => setLocation("/admin/orders")} className="w-full text-muted-foreground">
            Cancel
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
