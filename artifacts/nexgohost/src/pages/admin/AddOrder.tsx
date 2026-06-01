import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, ArrowLeft, Loader2, CheckCircle, FileText, Zap,
  DollarSign, Calendar, User, Package, Globe, Search, Plus,
  X, UserPlus, CheckCircle2, AlertCircle, Clock, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/context/CurrencyProvider";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Client {
  id: string; firstName: string; lastName: string;
  email: string; phone?: string; company?: string;
}
interface HostingPackage {
  id: string; name: string; price: number; yearlyPrice: number | null;
  module: string; modulePlanId: string | null; modulePlanName: string | null;
  diskSpace: string; bandwidth: string;
}
interface TldExtension {
  id: string; extension: string; registerPrice: string; renewalPrice: string; transferPrice: string;
  isActive: boolean;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") || localStorage.getItem("noehost_token") || "";
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

const DURATION_OPTIONS = [
  { label: "1 Month",  months: 1  },
  { label: "3 Months", months: 3  },
  { label: "6 Months", months: 6  },
  { label: "1 Year",   months: 12 },
  { label: "2 Years",  months: 24 },
];

function addMonthsToToday(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function formatDisplayDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const MODULE_BADGES: Record<string, { label: string; color: string; icon: string }> = {
  cpanel:      { label: "cPanel/WHM", color: "bg-orange-500/10 border-orange-500/20 text-orange-400", icon: "⚡" },
  "20i":       { label: "20i",        color: "bg-blue-500/10 border-blue-500/20 text-blue-400",       icon: "🔵" },
  directadmin: { label: "DirectAdmin",color: "bg-amber-500/10 border-amber-500/20 text-amber-400",   icon: "🟠" },
  plesk:       { label: "Plesk",      color: "bg-purple-500/10 border-purple-500/20 text-purple-400", icon: "🟣" },
  none:        { label: "None",       color: "bg-secondary/50 border-border text-muted-foreground",   icon: "—"  },
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function AddOrder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const queryClient = useQueryClient();

  const [packages, setPackages] = useState<HostingPackage[]>([]);
  const [tldExtensions, setTldExtensions] = useState<TldExtension[]>([]);
  const [selectedTldObj, setSelectedTldObj] = useState<TldExtension | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Client search state
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const clientRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(clientSearch, 300);

  // Add client modal state
  const [showAddClient, setShowAddClient] = useState(false);
  const [addClientForm, setAddClientForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", company: "" });
  const [addClientLoading, setAddClientLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Domain check state
  const [domainCheckStatus, setDomainCheckStatus] = useState<"idle" | "checking" | "available" | "taken" | "registered">("idle");
  const debouncedDomain = useDebounce("", 600);
  const [domainInput, setDomainInput] = useState("");
  const debouncedDomainInput = useDebounce(domainInput, 600);

  const [form, setForm] = useState({
    clientId: "",
    type: "hosting",
    itemId: "",
    itemName: "",
    domain: "",
    amount: "",
    billingCycle: "monthly",
    dueDate: addMonthsToToday(1),
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
    apiFetch("/api/admin/packages").then(d => setPackages(d || [])).catch(() => {});
    apiFetch("/api/domain-extensions").then(d => setTldExtensions((d || []).filter((t: TldExtension) => t.isActive))).catch(() => {});
  }, []);

  // Load initial 5 clients
  useEffect(() => {
    setClientSearchLoading(true);
    apiFetch("/api/admin/clients?limit=5")
      .then(d => setClientResults(d.clients || []))
      .catch(() => {})
      .finally(() => setClientSearchLoading(false));
  }, []);

  // Client search debounced
  useEffect(() => {
    setClientSearchLoading(true);
    const q = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}&limit=8` : "?limit=5";
    apiFetch(`/api/admin/clients${q}`)
      .then(d => setClientResults(d.clients || []))
      .catch(() => {})
      .finally(() => setClientSearchLoading(false));
  }, [debouncedSearch]);

  // Domain DB check — searches our system to see if domain already exists
  useEffect(() => {
    const domain = debouncedDomainInput.trim();
    if (!domain || !domain.includes(".")) { setDomainCheckStatus("idle"); return; }
    setDomainCheckStatus("checking");
    apiFetch(`/api/admin/domains?search=${encodeURIComponent(domain)}&limit=10`)
      .then((res: any) => {
        const list: any[] = res.data || [];
        // Match exact domain (name+tld or full domain)
        const found = list.find((d: any) => {
          const full = ((d.name || "") + (d.tld || "")).toLowerCase().replace(/^\./, "");
          const full2 = (d.domainName || d.domain || "").toLowerCase();
          return full === domain.toLowerCase() || full2 === domain.toLowerCase();
        });
        setDomainCheckStatus(found ? "registered" : "available");
      })
      .catch(() => setDomainCheckStatus("idle"));
  }, [debouncedDomainInput]);

  // Close client dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) {
        setClientDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectClient = (c: Client) => {
    setSelectedClient(c);
    setForm(f => ({ ...f, clientId: c.id }));
    setClientSearch("");
    setClientDropOpen(false);
    setErrors(e => ({ ...e, clientId: "" }));
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setForm(f => ({ ...f, clientId: "" }));
    setClientSearch("");
    setClientDropOpen(true);
  };

  const handleDomainInput = (val: string) => {
    setDomainInput(val);
    setForm(f => {
      const next = { ...f, domain: val };
      // Auto-fill item name from domain
      if (f.type === "domain" && val.trim()) next.itemName = `Domain — ${val.trim()}`;
      return next;
    });
    setErrors(e => ({ ...e, domain: "" }));
  };

  const handleTypeChange = (t: string) => {
    setForm(f => {
      const next = { ...f, type: t, itemId: "", itemName: "", amount: "" };
      if (t === "domain") {
        next.billingCycle = "yearly";
        next.dueDate = addMonthsToToday(12);
        if (f.domain) next.itemName = `Domain — ${f.domain}`;
      } else if (t === "hosting") {
        next.billingCycle = "monthly";
        next.dueDate = addMonthsToToday(1);
      }
      return next;
    });
    setSelectedPackage(null);
    setSelectedTldObj(null);
  };

  const handleTldSelect = (ext: string) => {
    const tld = tldExtensions.find(t => t.extension === ext) ?? null;
    setSelectedTldObj(tld);
    if (tld) {
      const price = parseFloat(tld.registerPrice) || 0;
      setForm(f => ({ ...f, amount: String(price) }));
    }
  };

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
      const next = { ...f, billingCycle: cycle };
      if (selectedPackage) {
        next.amount = String(cycle === "yearly" && selectedPackage.yearlyPrice ? selectedPackage.yearlyPrice : selectedPackage.price);
      }
      // Auto-update due date
      next.dueDate = addMonthsToToday(cycle === "yearly" ? 12 : 1);
      return next;
    });
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(err => ({ ...err, [field]: "" }));
  };

  const handleAddClient = async () => {
    const { firstName, lastName, email, password } = addClientForm;
    if (!firstName || !lastName || !email || !password) {
      toast({ title: "All required fields must be filled", variant: "destructive" }); return;
    }
    setAddClientLoading(true);
    try {
      const data = await apiFetch("/api/admin/clients", {
        method: "POST",
        body: JSON.stringify(addClientForm),
      });
      const newClient: Client = {
        id: data.id || data.client?.id,
        firstName, lastName, email,
        phone: addClientForm.phone,
        company: addClientForm.company,
      };
      setClientResults(r => [newClient, ...r]);
      handleSelectClient(newClient);
      setShowAddClient(false);
      setAddClientForm({ firstName: "", lastName: "", email: "", phone: "", password: "", company: "" });
      toast({ title: "Client added", description: `${firstName} ${lastName} has been created.` });
    } catch (err: any) {
      toast({ title: "Failed to add client", description: err.message, variant: "destructive" });
    } finally {
      setAddClientLoading(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.clientId) e.clientId = "Client is required";
    if (!form.itemName.trim()) e.itemName = "Item name is required";
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) < 0) e.amount = "Valid amount is required";
    if (form.type === "domain" && !form.domain.trim()) e.domain = "Domain name is required";
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
                <p className="text-sm text-muted-foreground">{formatPrice(Number(result.order?.amount || 0))} · {result.order?.billingCycle}</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${result.order?.status === "approved" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                  {result.order?.status}
                </span>
              </div>
              {result.invoice && (
                <div className="bg-secondary/50 border border-border rounded-xl p-4 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Invoice</p>
                  <p className="font-mono font-semibold text-primary">{result.invoice?.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">{formatPrice(Number(result.invoice?.total || 0))}</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${result.invoice?.status === "paid" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
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
              <Button variant="outline" onClick={() => {
                setResult(null);
                setForm(f => ({ ...f, itemId: "", itemName: "", amount: "", notes: "" }));
                setSelectedPackage(null);
              }}>
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

        {/* ── Section 1: Client & Order Type ── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <User size={20} className="text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-foreground">Client & Order Type</h2>
              <p className="text-xs text-muted-foreground">Who this order is for and what type it is</p>
            </div>
          </div>

          {/* Client Search */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground/80">Client *</label>
              <button type="button" onClick={() => setShowAddClient(true)}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-semibold transition-colors">
                <UserPlus size={13} /> Add New Client
              </button>
            </div>

            {selectedClient ? (
              /* Selected client pill */
              <div className="flex items-center gap-3 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-primary">
                    {selectedClient.firstName[0]}{selectedClient.lastName[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {selectedClient.firstName} {selectedClient.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{selectedClient.email}
                    {selectedClient.phone && <span className="ml-2 text-muted-foreground/70">· {selectedClient.phone}</span>}
                  </p>
                </div>
                <button type="button" onClick={handleClearClient}
                  className="w-6 h-6 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0">
                  <X size={13} />
                </button>
              </div>
            ) : (
              /* Search box + dropdown */
              <div className="relative" ref={clientRef}>
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setClientDropOpen(true); }}
                  onFocus={() => setClientDropOpen(true)}
                  placeholder="Search by name, email or phone…"
                  className={`pl-9 ${errors.clientId ? "border-destructive" : ""}`}
                />
                {clientSearchLoading && (
                  <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
                )}

                <AnimatePresence>
                  {clientDropOpen && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                      {clientResults.length === 0 && !clientSearchLoading && (
                        <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                          {clientSearch ? "No clients found" : "No clients yet"}
                        </div>
                      )}
                      {!clientSearch && clientResults.length > 0 && (
                        <div className="px-3 py-1.5 border-b border-border/50">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Recent Clients</span>
                        </div>
                      )}
                      {clientResults.map(c => (
                        <button key={c.id} type="button" onClick={() => handleSelectClient(c)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/60 transition-colors text-left">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-black text-primary">
                              {c.firstName[0]}{c.lastName[0]}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {c.firstName} {c.lastName}
                              {c.company && <span className="ml-1.5 text-xs text-muted-foreground font-normal">({c.company})</span>}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {c.email}{c.phone && ` · ${c.phone}`}
                            </p>
                          </div>
                        </button>
                      ))}
                      <div className="px-3 py-2 border-t border-border/50">
                        <button type="button" onClick={() => { setShowAddClient(true); setClientDropOpen(false); }}
                          className="w-full flex items-center gap-2 py-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                          <Plus size={13} /> Add new client
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            {errors.clientId && <p className="text-xs text-destructive">{errors.clientId}</p>}
          </div>

          {/* Order Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Order Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {["hosting", "domain", "upgrade", "renewal"].map(t => (
                <button key={t} type="button" onClick={() => handleTypeChange(t)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium capitalize transition-all ${form.type === t ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Section 2: Package / Item ── */}
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
                    {p.name} — {formatPrice(Number(p.price))}/mo{p.yearlyPrice ? ` | ${formatPrice(Number(p.yearlyPrice))}/yr` : ""}
                    {p.module && p.module !== "none" ? ` [${p.module}]` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Module info badge */}
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

          {/* Domain field */}
          {(form.type === "domain" || form.type === "hosting") && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">
                {form.type === "domain" ? "Domain Name *" : "Domain (optional)"}
              </label>
              <div className="relative">
                <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={domainInput}
                  onChange={e => handleDomainInput(e.target.value)}
                  placeholder="example.com"
                  className={`pl-9 pr-10 ${errors.domain ? "border-destructive" : domainCheckStatus === "registered" ? "border-amber-500/60" : domainCheckStatus === "available" ? "border-emerald-500/60" : ""}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {domainCheckStatus === "checking" && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                  {domainCheckStatus === "available" && <CheckCircle2 size={14} className="text-emerald-500" />}
                  {domainCheckStatus === "registered" && <AlertCircle size={14} className="text-amber-500" />}
                </div>
              </div>
              <AnimatePresence>
                {domainCheckStatus === "registered" && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-amber-600 flex items-center gap-1.5">
                    <AlertCircle size={11} /> Already registered in your system
                  </motion.p>
                )}
                {domainCheckStatus === "available" && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 size={11} /> Not in your system — looks new
                  </motion.p>
                )}
              </AnimatePresence>
              {errors.domain && <p className="text-xs text-destructive">{errors.domain}</p>}
            </div>
          )}

          {/* TLD selector — domain type only */}
          {form.type === "domain" && tldExtensions.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">TLD Extension & Price Auto-fill</label>
              <select
                value={selectedTldObj?.extension ?? ""}
                onChange={e => handleTldSelect(e.target.value)}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— Select TLD to auto-fill price —</option>
                {tldExtensions.map(t => (
                  <option key={t.id} value={t.extension}>
                    {t.extension} — Register: {Number(t.registerPrice).toLocaleString()} / Renew: {Number(t.renewalPrice).toLocaleString()}
                  </option>
                ))}
              </select>
              {selectedTldObj && (
                <p className="text-[11px] text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 size={10} /> Price auto-filled: {Number(selectedTldObj.registerPrice).toLocaleString()} (register) · {Number(selectedTldObj.renewalPrice).toLocaleString()} (renewal)
                </p>
              )}
            </div>
          )}

          {/* Item Name — auto-filled */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Item Name *</label>
            <Input
              value={form.itemName}
              onChange={set("itemName")}
              placeholder={form.type === "domain" ? "Domain — example.com" : form.type === "hosting" ? "e.g. Business Hosting Plan" : "Item name…"}
              className={errors.itemName ? "border-destructive" : ""}
            />
            {errors.itemName && <p className="text-xs text-destructive">{errors.itemName}</p>}
            {(selectedPackage || (form.type === "domain" && form.domain)) && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <CheckCircle2 size={10} className="text-primary" /> Auto-filled from {form.type === "domain" ? "domain name" : "selected package"}
              </p>
            )}
          </div>
        </div>

        {/* ── Section 3: Billing & Pricing ── */}
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
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground/80">Billing Cycle</label>
              {form.type === "domain" && (
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Auto-set to Yearly for domains</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["monthly", "yearly"].map(cycle => (
                <button key={cycle} type="button" onClick={() => handleBillingCycleChange(cycle)}
                  disabled={form.type === "domain"}
                  className={`py-2.5 rounded-xl border text-sm font-medium capitalize transition-all disabled:opacity-60 disabled:cursor-not-allowed ${form.billingCycle === cycle ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {cycle}
                  {selectedPackage && (
                    <span className="ml-2 text-xs opacity-70">
                      {cycle === "yearly" && selectedPackage.yearlyPrice ? formatPrice(Number(selectedPackage.yearlyPrice)) : formatPrice(Number(selectedPackage.price))}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Amount *</label>
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

        {/* ── Section 4: Schedule & Notes ── */}
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

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Next Due Date</label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map(opt => {
                const val = addMonthsToToday(opt.months);
                const active = form.dueDate === val;
                return (
                  <button key={opt.months} type="button"
                    onClick={() => setForm(f => ({ ...f, dueDate: val }))}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${active ? "bg-blue-500/15 border-blue-500/40 text-blue-400" : "border-border text-muted-foreground hover:border-blue-500/30 hover:text-blue-400"}`}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {form.dueDate && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
                <Calendar size={12} className="text-blue-400" />
                Due: <span className="text-blue-400 font-medium">{formatDisplayDate(form.dueDate)}</span>
              </p>
            )}
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

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Order Notes</label>
            <textarea value={form.notes} onChange={set("notes")} rows={3}
              placeholder="Optional internal notes for this order…"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>

        {/* ── Save Actions ── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold text-foreground mb-4">Save Order</h2>
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

      {/* ── Add Client Modal ── */}
      <AnimatePresence>
        {showAddClient && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowAddClient(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <UserPlus size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Add New Client</h3>
                    <p className="text-xs text-muted-foreground">Create client and add to this order</p>
                  </div>
                </div>
                <button onClick={() => setShowAddClient(false)}
                  className="w-8 h-8 rounded-xl hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/70">First Name *</label>
                  <Input value={addClientForm.firstName} onChange={e => setAddClientForm(f => ({ ...f, firstName: e.target.value }))} placeholder="John" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/70">Last Name *</label>
                  <Input value={addClientForm.lastName} onChange={e => setAddClientForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Doe" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/70">Email *</label>
                <Input type="email" value={addClientForm.email} onChange={e => setAddClientForm(f => ({ ...f, email: e.target.value }))} placeholder="john@example.com" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/70">Password *</label>
                <div className="relative">
                  <Input type={showPass ? "text" : "password"} value={addClientForm.password}
                    onChange={e => setAddClientForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 characters" className="pr-10" />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/70">Phone</label>
                  <Input value={addClientForm.phone} onChange={e => setAddClientForm(f => ({ ...f, phone: e.target.value }))} placeholder="+92 300 0000000" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/70">Company</label>
                  <Input value={addClientForm.company} onChange={e => setAddClientForm(f => ({ ...f, company: e.target.value }))} placeholder="Optional" />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button onClick={handleAddClient} disabled={addClientLoading} className="flex-1 bg-primary hover:bg-primary/90">
                  {addClientLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : <UserPlus size={14} className="mr-2" />}
                  {addClientLoading ? "Creating…" : "Create & Select Client"}
                </Button>
                <Button variant="outline" onClick={() => setShowAddClient(false)} className="flex-1">Cancel</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
