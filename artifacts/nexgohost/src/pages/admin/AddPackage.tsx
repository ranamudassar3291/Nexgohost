import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, ArrowLeft, Loader2, Plus, X, Server, ChevronDown,
  DollarSign, AlertCircle, CheckCircle, Zap, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ProductGroup { id: string; name: string; }
interface ServerRecord { id: string; name: string; type: string; status: string; }
interface Plan { id: string; name: string; monthlyPrice: number; yearlyPrice: number; }

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

const MODULE_OPTIONS = [
  { value: "none",         label: "None",          icon: "—" },
  { value: "cpanel",       label: "cPanel / WHM",  icon: "⚡" },
  { value: "20i",          label: "20i",           icon: "🔵" },
  { value: "directadmin",  label: "DirectAdmin",   icon: "🟠" },
  { value: "plesk",        label: "Plesk",         icon: "🟣" },
];

const MODULE_COLORS: Record<string, string> = {
  cpanel: "bg-orange-500/10 border-orange-500/20 text-orange-400",
  "20i": "bg-blue-500/10 border-blue-500/20 text-blue-400",
  directadmin: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  plesk: "bg-purple-500/10 border-purple-500/20 text-purple-400",
  none: "bg-secondary/50 border-border text-muted-foreground",
};

export default function AddPackage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [form, setForm] = useState({
    name: "", description: "", price: "", yearlyPrice: "", billingCycle: "monthly",
    groupId: "",
    diskSpace: "10 GB", bandwidth: "100 GB",
    emailAccounts: "10", databases: "5", subdomains: "10", ftpAccounts: "5",
  });
  const [features, setFeatures] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Module flow state
  const [moduleType, setModuleType] = useState("none");
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [modulePlanId, setModulePlanId] = useState("");
  const [modulePlanName, setModulePlanName] = useState("");
  const [pricingFrom, setPricingFrom] = useState<"module" | "manual">("manual");

  useEffect(() => {
    apiFetch("/api/admin/product-groups").then(setGroups).catch(() => {});
  }, []);

  // Fetch servers when module type changes
  useEffect(() => {
    if (moduleType === "none") {
      setServers([]); setSelectedServerId(""); setPlans([]); setSelectedPlan(null);
      setModulePlanId(""); setModulePlanName(""); setPricingFrom("manual");
      return;
    }
    setLoadingServers(true);
    setSelectedServerId(""); setPlans([]); setSelectedPlan(null); setPlansError("");
    apiFetch(`/api/admin/servers?type=${moduleType}`)
      .then(data => setServers(data.filter((s: ServerRecord) => s.status === "active")))
      .catch(() => setServers([]))
      .finally(() => setLoadingServers(false));
  }, [moduleType]);

  // Fetch plans when server changes
  const fetchPlans = async (serverId: string) => {
    if (!serverId) { setPlans([]); setSelectedPlan(null); return; }
    setLoadingPlans(true); setPlansError(""); setSelectedPlan(null);
    try {
      const data = await apiFetch(`/api/admin/servers/${serverId}/plans`);
      const planList: Plan[] = data.plans || [];
      setPlans(planList);
      // Use API-level error message (e.g. WHM not reachable, no packages found)
      if (data.error) {
        setPlansError(data.error);
      } else if (planList.length === 0) {
        setPlansError("No packages found on this server.");
      }
    } catch (err: any) {
      setPlansError(err.message || "Failed to fetch packages from server.");
      setPlans([]);
    } finally { setLoadingPlans(false); }
  };

  const handleServerChange = (serverId: string) => {
    setSelectedServerId(serverId);
    setSelectedPlan(null); setModulePlanId(""); setModulePlanName("");
    fetchPlans(serverId);
  };

  const handlePlanSelect = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    setSelectedPlan(plan);
    setModulePlanId(plan.id);
    setModulePlanName(plan.name);
    // WHM packages have no pricing — only auto-fill for non-cpanel modules that return real prices
    if (moduleType !== "cpanel" && plan.monthlyPrice > 0) {
      setForm(f => ({
        ...f,
        price: String(plan.monthlyPrice),
        yearlyPrice: String(plan.yearlyPrice),
      }));
      setPricingFrom("module");
    }
    setErrors(e => ({ ...e, price: "" }));
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(err => ({ ...err, [field]: "" }));
    if (field === "price" || field === "yearlyPrice") setPricingFrom("manual");
  };

  const addFeature = () => {
    if (featureInput.trim() && !features.includes(featureInput.trim())) {
      setFeatures(f => [...f, featureInput.trim()]);
      setFeatureInput("");
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Package name is required";
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) e.price = "Valid monthly price is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await apiFetch("/api/admin/packages", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          yearlyPrice: form.yearlyPrice ? Number(form.yearlyPrice) : null,
          groupId: form.groupId || null,
          module: moduleType,
          moduleServerId: selectedServerId || null,
          modulePlanId: modulePlanId || null,
          modulePlanName: modulePlanName || null,
          emailAccounts: parseInt(form.emailAccounts),
          databases: parseInt(form.databases),
          subdomains: parseInt(form.subdomains),
          ftpAccounts: parseInt(form.ftpAccounts),
          features,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast({ title: "Package created", description: `${form.name} is now available.` });
      setLocation("/admin/packages");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const selectedModuleOption = MODULE_OPTIONS.find(m => m.value === moduleType);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/packages")} className="rounded-xl">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Add Package</h1>
          <p className="text-muted-foreground text-sm">Create a new hosting package with module plan assignment</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-5">
        {/* Basic Info */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Package Details</h2>
              <p className="text-xs text-muted-foreground">Name, group, and description</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Package Name *</label>
            <Input value={form.name} onChange={set("name")} placeholder="Starter Plan"
              className={errors.name ? "border-destructive" : ""} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Product Group</label>
            <select value={form.groupId} onChange={set("groupId")}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">No group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of this package…" rows={2}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>

        {/* ── Module Configuration ── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Zap size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Module Configuration</h2>
              <p className="text-xs text-muted-foreground">Link this package to a hosting module plan for automated provisioning</p>
            </div>
          </div>

          {/* Step 1: Module Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Step 1 — Select Module Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MODULE_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setModuleType(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    moduleType === opt.value
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                  }`}>
                  <span className="text-base leading-none">{opt.icon}</span>
                  {opt.label}
                  {moduleType === opt.value && <CheckCircle size={13} className="ml-auto text-primary" />}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {moduleType !== "none" && (
              <motion.div key="module-steps" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden">

                {/* Module type badge */}
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${MODULE_COLORS[moduleType]}`}>
                  <Server size={12} /> {selectedModuleOption?.label} Module Active
                </div>

                {/* Step 2: Server */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">
                    Step 2 — Select Server
                    {loadingServers && <Loader2 size={13} className="inline ml-2 animate-spin text-primary" />}
                  </label>
                  {!loadingServers && servers.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl text-sm text-amber-400">
                      <AlertCircle size={14} />
                      No active {selectedModuleOption?.label} servers found. Add a server first in the Servers section.
                    </div>
                  ) : (
                    <select value={selectedServerId} onChange={e => handleServerChange(e.target.value)} disabled={loadingServers}
                      className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50">
                      <option value="">— Choose a server —</option>
                      {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </div>

                {/* Step 3: Plan */}
                <AnimatePresence>
                  {selectedServerId && (
                    <motion.div key="plan-step" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-foreground/80">
                          Step 3 — Select Plan
                          {loadingPlans && <Loader2 size={13} className="inline ml-2 animate-spin text-primary" />}
                        </label>
                        <button type="button" onClick={() => fetchPlans(selectedServerId)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                          <RefreshCw size={11} /> Refresh
                        </button>
                      </div>

                      {plansError && plans.length === 0 ? (
                        <div className="flex items-start gap-2 px-3 py-3 bg-destructive/5 border border-destructive/20 rounded-xl text-sm text-destructive">
                          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {plansError}
                        </div>
                      ) : plans.length === 0 && !loadingPlans ? (
                        <div className="px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-muted-foreground text-center">
                          No packages available on this server
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {moduleType === "cpanel" && plans.length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/5 border border-orange-500/20 rounded-xl text-xs text-orange-400">
                              <AlertCircle size={12} className="shrink-0" />
                              WHM packages have no pricing — set your billing price in the Pricing section below.
                            </div>
                          )}
                          {plansError && plans.length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/5 border border-yellow-500/20 rounded-xl text-xs text-yellow-400">
                              <AlertCircle size={12} className="shrink-0" /> {plansError}
                            </div>
                          )}
                          <div className="grid gap-2">
                            {plans.map(plan => (
                              <button key={plan.id} type="button" onClick={() => handlePlanSelect(plan.id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                                  modulePlanId === plan.id
                                    ? "bg-primary/10 border-primary/40"
                                    : "bg-background border-border hover:border-primary/30"
                                }`}>
                                <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${modulePlanId === plan.id ? "bg-primary border-primary" : "border-border"}`} />
                                <div className="flex-1">
                                  <p className={`text-sm font-medium ${modulePlanId === plan.id ? "text-primary" : "text-foreground"}`}>{plan.name}</p>
                                  <p className="text-xs text-muted-foreground font-mono">{plan.id}</p>
                                </div>
                                {moduleType !== "cpanel" && plan.monthlyPrice > 0 && (
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-semibold text-foreground">${plan.monthlyPrice.toFixed(2)}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                                    <p className="text-xs text-muted-foreground">${plan.yearlyPrice.toFixed(2)}/yr</p>
                                  </div>
                                )}
                                {modulePlanId === plan.id && <CheckCircle size={15} className="text-primary shrink-0" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* WHM package selected notice */}
                <AnimatePresence>
                  {selectedPlan && moduleType === "cpanel" && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-start gap-2.5 px-4 py-3 bg-orange-500/5 border border-orange-500/20 rounded-xl text-sm text-orange-400">
                      <CheckCircle size={15} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">WHM package "<strong>{selectedPlan.name}</strong>" selected</p>
                        <p className="text-xs text-orange-400/70 mt-0.5">Enter your billing price below — WHM packages have no pricing data.</p>
                      </div>
                    </motion.div>
                  )}
                  {selectedPlan && pricingFrom === "module" && moduleType !== "cpanel" && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-start gap-2.5 px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
                      <CheckCircle size={15} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Plan prices auto-filled from {selectedModuleOption?.label} API</p>
                        <p className="text-xs text-emerald-400/70 mt-0.5">
                          <strong>{selectedPlan.name}</strong>: ${selectedPlan.monthlyPrice}/mo · ${selectedPlan.yearlyPrice}/yr — adjust below if needed
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Pricing ── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <DollarSign size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Pricing</h2>
              <p className="text-xs text-muted-foreground">
                {moduleType === "cpanel"
                  ? "WHM packages have no pricing — enter your billing prices here"
                  : pricingFrom === "module"
                    ? "Auto-filled from module API — edit to override"
                    : "Set your monthly and yearly prices"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Monthly Price ($) *</label>
              <Input type="number" step="0.01" min="0" value={form.price} onChange={set("price")} placeholder="9.99"
                className={`${errors.price ? "border-destructive" : ""} ${pricingFrom === "module" ? "border-primary/30 bg-primary/5" : ""}`} />
              {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Yearly Price ($)</label>
              <Input type="number" step="0.01" min="0" value={form.yearlyPrice} onChange={set("yearlyPrice")} placeholder="99.99"
                className={pricingFrom === "module" ? "border-primary/30 bg-primary/5" : ""} />
              <p className="text-xs text-muted-foreground">Leave blank to default to monthly × 12</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Billing Cycle</label>
            <select value={form.billingCycle} onChange={set("billingCycle")}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        {/* ── Resources ── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Server size={20} className="text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Resources & Features</h2>
              <p className="text-xs text-muted-foreground">Storage, bandwidth, and included accounts</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { field: "diskSpace",     label: "Disk Space",     placeholder: "10 GB"  },
              { field: "bandwidth",     label: "Bandwidth",      placeholder: "100 GB" },
              { field: "emailAccounts", label: "Email Accounts", placeholder: "10"     },
              { field: "databases",     label: "Databases",      placeholder: "5"      },
              { field: "subdomains",    label: "Subdomains",     placeholder: "10"     },
              { field: "ftpAccounts",   label: "FTP Accounts",   placeholder: "5"      },
            ].map(({ field, label, placeholder }) => (
              <div key={field} className="space-y-1">
                <label className="text-xs text-muted-foreground">{label}</label>
                <Input value={form[field as keyof typeof form]} onChange={set(field)} placeholder={placeholder} className="h-9 text-sm" />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Feature Tags</label>
            <div className="flex gap-2">
              <Input value={featureInput} onChange={e => setFeatureInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}
                placeholder="e.g. Free SSL Certificate" className="flex-1" />
              <Button type="button" variant="outline" size="icon" onClick={addFeature} className="rounded-xl shrink-0"><Plus size={16} /></Button>
            </div>
            {features.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {features.map(f => (
                  <span key={f} className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-xs rounded-full">
                    {f}
                    <button type="button" onClick={() => setFeatures(feats => feats.filter(x => x !== f))}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <Button type="button" onClick={handleSubmit} disabled={loading} className="flex-1 bg-primary hover:bg-primary/90 h-12">
            {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <Package size={18} className="mr-2" />}
            {loading ? "Creating Package…" : "Create Package"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setLocation("/admin/packages")} className="h-12 px-6">Cancel</Button>
        </div>
      </div>
    </motion.div>
  );
}
