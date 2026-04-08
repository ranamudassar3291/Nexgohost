import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, ArrowLeft, Loader2, Plus, X, Server,
  DollarSign, AlertCircle, CheckCircle, Zap, RefreshCw, Globe, Gift, Copy, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrency } from "@/context/CurrencyProvider";

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
  { value: "none",        label: "None",         icon: "—" },
  { value: "cpanel",      label: "cPanel / WHM", icon: "⚡" },
  { value: "20i",         label: "20i",          icon: "🔵" },
  { value: "directadmin", label: "DirectAdmin",  icon: "🟠" },
  { value: "plesk",       label: "Plesk",        icon: "🟣" },
];

const MODULE_COLORS: Record<string, string> = {
  cpanel: "bg-orange-500/10 border-orange-500/20 text-orange-400",
  "20i": "bg-blue-500/10 border-blue-500/20 text-blue-400",
  directadmin: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  plesk: "bg-purple-500/10 border-purple-500/20 text-purple-400",
  none: "bg-secondary/50 border-border text-muted-foreground",
};

export default function EditPackage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const queryClient = useQueryClient();

  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: "", description: "", price: "", yearlyPrice: "", quarterlyPrice: "", semiannualPrice: "",
    renewalPrice: "", saveAmount: "",
    billingCycle: "monthly",
    groupId: "",
    diskSpace: "", bandwidth: "",
    emailAccounts: "", databases: "", subdomains: "", ftpAccounts: "",
  });
  const [features, setFeatures] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState("");

  // Module flow state
  const [moduleType, setModuleType] = useState("none");
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [plansFrom20i, setPlansFrom20i] = useState(false);
  const [plansOutboundIp, setPlansOutboundIp] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [modulePlanId, setModulePlanId] = useState("");
  const [modulePlanName, setModulePlanName] = useState("");
  const [pricingFrom, setPricingFrom] = useState<"module" | "manual">("manual");

  const [selectedServerGroupId, setSelectedServerGroupId] = useState<string>("");

  // Product groups for the group dropdown
  const [groups, setGroups] = useState<ProductGroup[]>([]);

  // Free domain & renewal settings
  const [renewalEnabled, setRenewalEnabled] = useState(true);
  const [freeDomainEnabled, setFreeDomainEnabled] = useState(false);
  const [freeDomainTlds, setFreeDomainTlds] = useState<string[]>([]);

  const COMMON_TLDS = [".com", ".net", ".org", ".pk", ".uk", ".info", ".biz"];

  const toggleFreeTld = (tld: string) => {
    setFreeDomainTlds(prev => prev.includes(tld) ? prev.filter(t => t !== tld) : [...prev, tld]);
  };

  // Fetch product groups for the dropdown
  useEffect(() => {
    apiFetch("/api/admin/product-groups").then(setGroups).catch(() => {});
  }, []);

  // Ref to restore the server selection after initial load
  const restoredServerId = useRef<string>("");

  // Load existing package — also pre-loads servers + plans
  useEffect(() => {
    apiFetch(`/api/admin/packages/${id}`)
      .then(async data => {
        setForm({
          name: data.name || "",
          description: data.description || "",
          price: String(data.price || ""),
          yearlyPrice: data.yearlyPrice ? String(data.yearlyPrice) : "",
          quarterlyPrice: data.quarterlyPrice ? String(data.quarterlyPrice) : "",
          semiannualPrice: data.semiannualPrice ? String(data.semiannualPrice) : "",
          renewalPrice: data.renewalPrice ? String(data.renewalPrice) : "",
          saveAmount: data.saveAmount ? String(data.saveAmount) : "",
          billingCycle: data.billingCycle || "monthly",
          groupId: data.groupId || "",
          diskSpace: data.diskSpace || "",
          bandwidth: data.bandwidth || "",
          emailAccounts: String(data.emailAccounts || ""),
          databases: String(data.databases || ""),
          subdomains: String(data.subdomains || ""),
          ftpAccounts: String(data.ftpAccounts || ""),
        });
        setFeatures(data.features || []);
        setRenewalEnabled(data.renewalEnabled !== false);
        setFreeDomainEnabled(!!data.freeDomainEnabled);
        setFreeDomainTlds(Array.isArray(data.freeDomainTlds) ? data.freeDomainTlds : []);

        const mod = data.module || "none";
        const savedServerId: string = data.moduleServerId || "";
        const savedGroupId: string = data.moduleServerGroupId || "";
        const savedPlanId: string = data.modulePlanId || "";
        const savedPlanName: string = data.modulePlanName || savedPlanId;

        setModuleType(mod);
        setSelectedServerGroupId(savedGroupId);
        if (savedPlanId) {
          setModulePlanId(savedPlanId);
          setModulePlanName(savedPlanName);
        }

        // Pre-load servers and plans if a module was previously configured
        if (mod !== "none") {
          restoredServerId.current = savedServerId;
          try {
            setLoadingServers(true);
            const serverData = await apiFetch(`/api/admin/servers?type=${mod}`);
            const active = (serverData as ServerRecord[]).filter(s => s.status === "active");
            setServers(active);

            // Pre-select the saved server
            if (savedServerId && active.find(s => s.id === savedServerId)) {
              setSelectedServerId(savedServerId);
              // Pre-load plans for this server
              if (savedPlanId) {
                try {
                  setLoadingPlans(true);
                  const planData = await apiFetch(`/api/admin/servers/${savedServerId}/plans`);
                  const planList: Plan[] = planData.plans || [];
                  setPlans(planList);
                  const existing = planList.find(p => p.id === savedPlanId);
                  if (existing) setSelectedPlan(existing);
                } catch {
                  setPlans([]);
                } finally {
                  setLoadingPlans(false);
                }
              }
            }
          } catch {
            setServers([]);
          } finally {
            setLoadingServers(false);
          }
        }
      })
      .catch(() => toast({ title: "Error", description: "Could not load package", variant: "destructive" }))
      .finally(() => setFetching(false));
  }, [id]);

  // Fetch servers when module type is manually changed by the user
  // (not on initial load — that is handled above)
  const handleModuleTypeChange = (newType: string) => {
    setModuleType(newType);
    setSelectedServerId("");
    setSelectedServerGroupId("");
    setPlans([]);
    setSelectedPlan(null);
    setPlansError("");
    if (newType === "none") { setServers([]); return; }
    setLoadingServers(true);
    apiFetch(`/api/admin/servers?type=${newType}`)
      .then(data => setServers((data as ServerRecord[]).filter(s => s.status === "active")))
      .catch(() => setServers([]))
      .finally(() => setLoadingServers(false));
  };

  const fetchPlans = async (serverId: string) => {
    if (!serverId) { setPlans([]); setSelectedPlan(null); setPlansOutboundIp(""); setPlansFrom20i(false); return; }
    setLoadingPlans(true); setPlansError(""); setPlansOutboundIp(""); setPlansFrom20i(false); setSelectedPlan(null);
    try {
      const data = await apiFetch(`/api/admin/servers/${serverId}/plans`);
      const planList: Plan[] = data.plans || [];
      setPlans(planList);
      if (data.from20i) setPlansFrom20i(true);
      if (data.outboundIp) setPlansOutboundIp(data.outboundIp);
      if (data.error) {
        setPlansError(data.error);
      } else if (planList.length === 0 && !data.from20i) {
        setPlansError("No packages found on this server.");
      }
      // If editing and there's already a modulePlanId, highlight it
      if (modulePlanId && planList.find(p => p.id === modulePlanId)) {
        const existing = planList.find(p => p.id === modulePlanId)!;
        setSelectedPlan(existing);
      }
    } catch (err: any) {
      setPlansError(err.message || "Failed to fetch packages from server.");
      setPlans([]);
    } finally { setLoadingPlans(false); }
  };

  const handleServerChange = (serverId: string) => {
    setSelectedServerId(serverId);
    setSelectedPlan(null);
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
      await apiFetch(`/api/admin/packages/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          yearlyPrice: form.yearlyPrice ? Number(form.yearlyPrice) : null,
          quarterlyPrice: form.quarterlyPrice ? Number(form.quarterlyPrice) : null,
          semiannualPrice: form.semiannualPrice ? Number(form.semiannualPrice) : null,
          groupId: form.groupId || null,
          module: moduleType,
          moduleServerId: selectedServerId || null,
          moduleServerGroupId: selectedServerGroupId || null,
          modulePlanId: modulePlanId || null,
          modulePlanName: modulePlanName || null,
          emailAccounts: parseInt(form.emailAccounts) || 10,
          databases: parseInt(form.databases) || 5,
          subdomains: parseInt(form.subdomains) || 10,
          ftpAccounts: parseInt(form.ftpAccounts) || 5,
          features,
          renewalEnabled,
          renewalPrice: form.renewalPrice ? Number(form.renewalPrice) : null,
          saveAmount: form.saveAmount ? Number(form.saveAmount) : null,
          freeDomainEnabled,
          freeDomainTlds,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast({ title: "Package updated", description: `${form.name} has been saved.` });
      setLocation("/admin/packages");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const selectedModuleOption = MODULE_OPTIONS.find(m => m.value === moduleType);

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/packages")} className="rounded-xl">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Edit Package</h1>
          <p className="text-muted-foreground text-sm">Update details, pricing and module configuration</p>
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
              rows={2}
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
              <p className="text-xs text-muted-foreground">
                {modulePlanId
                  ? `Currently linked to plan: ${modulePlanName || modulePlanId} — change below`
                  : "Link this package to a hosting module plan for automated provisioning"}
              </p>
            </div>
          </div>

          {/* Current plan badge — shows when a plan is saved but not currently being selected from a list */}
          {modulePlanId && !selectedPlan && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/20 rounded-xl text-sm">
              <CheckCircle size={14} className="text-primary" />
              <span className="text-primary font-medium">Linked plan:</span>
              <span className="text-foreground">{modulePlanName || modulePlanId}</span>
              <button type="button" onClick={() => { setModulePlanId(""); setModulePlanName(""); }}
                className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Step 1: Module Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Module Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MODULE_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => handleModuleTypeChange(opt.value)}
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

                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${MODULE_COLORS[moduleType]}`}>
                  <Server size={12} /> {selectedModuleOption?.label} Module
                </div>

                {/* Server Group (optional) */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Server Group <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={selectedServerGroupId}
                    onChange={e => setSelectedServerGroupId(e.target.value)}
                    placeholder="e.g. us-east or leave blank"
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <p className="text-xs text-muted-foreground">When set, new accounts will be provisioned on any active server in this group. Overrides the specific server selection below.</p>
                </div>

                {/* Step 2: Server */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">
                    Select Server
                    {loadingServers && <Loader2 size={13} className="inline ml-2 animate-spin text-primary" />}
                  </label>
                  {!loadingServers && servers.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl text-sm text-amber-400">
                      <AlertCircle size={14} />
                      No active {selectedModuleOption?.label} servers found. Add a server first.
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
                          Select Plan
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
                      ) : plans.length === 0 && !loadingPlans && plansFrom20i ? (
                        <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 text-center">
                          No packages synced yet from 20i — add packages in your 20i reseller portal first, then refresh here.
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
                                    <p className="text-sm font-semibold text-foreground">{formatPrice(plan.monthlyPrice)}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                                    <p className="text-xs text-muted-foreground">{formatPrice(plan.yearlyPrice)}/yr</p>
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
                        <p className="font-medium">Prices updated from {selectedModuleOption?.label} API</p>
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
                    : "Monthly and yearly pricing"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Monthly Price *</label>
              <Input type="number" step="0.01" min="0" value={form.price} onChange={set("price")} placeholder="9.99"
                className={`${errors.price ? "border-destructive" : ""} ${pricingFrom === "module" ? "border-primary/30 bg-primary/5" : ""}`} />
              {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Quarterly Price <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
              <Input type="number" step="0.01" min="0" value={form.quarterlyPrice} onChange={set("quarterlyPrice")} placeholder="27.99" />
              <p className="text-xs text-muted-foreground">Billed every 3 months</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Semiannual Price <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
              <Input type="number" step="0.01" min="0" value={form.semiannualPrice} onChange={set("semiannualPrice")} placeholder="53.99" />
              <p className="text-xs text-muted-foreground">Billed every 6 months</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Yearly Price <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
              <Input type="number" step="0.01" min="0" value={form.yearlyPrice} onChange={set("yearlyPrice")} placeholder="99.99"
                className={pricingFrom === "module" ? "border-primary/30 bg-primary/5" : ""} />
              <p className="text-xs text-muted-foreground">Billed annually</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Default Billing Cycle</label>
            <select value={form.billingCycle} onChange={set("billingCycle")}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="semiannual">Semiannual</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        {/* ── Free Domain & Renewal ── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Globe size={20} className="text-green-400" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Domain & Renewal Settings</h2>
              <p className="text-xs text-muted-foreground">Configure free domain and renewal options</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary/30 border border-border rounded-xl">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Renewal</p>
              <p className="text-xs text-muted-foreground mt-0.5">Allow clients to renew this hosting plan</p>
            </div>
            <button type="button" onClick={() => setRenewalEnabled(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${renewalEnabled ? "bg-primary" : "bg-muted"}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${renewalEnabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {renewalEnabled && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Renewal Price (PKR) <span className="text-muted-foreground text-xs font-normal">— leave blank to use standard price</span></label>
              <Input type="number" step="0.01" min="0" placeholder="e.g. 2999.00"
                value={form.renewalPrice}
                onChange={e => setForm(f => ({ ...f, renewalPrice: e.target.value }))}
                className="h-10" />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80">Show Save Amount <span className="text-muted-foreground text-xs font-normal">— displays a "Save Rs. X" badge on plan cards</span></label>
            <Input type="number" step="0.01" min="0" placeholder="e.g. 1000 — leave blank to hide badge"
              value={form.saveAmount}
              onChange={e => setForm(f => ({ ...f, saveAmount: e.target.value }))}
              className="h-10" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-secondary/30 border border-border rounded-xl">
              <div className="flex items-center gap-3">
                <Gift size={16} className="text-green-400" />
                <div>
                  <p className="text-sm font-medium text-foreground">Free Domain with Yearly Plan</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Clients get one free domain when buying yearly</p>
                </div>
              </div>
              <button type="button" onClick={() => setFreeDomainEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${freeDomainEnabled ? "bg-primary" : "bg-muted"}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${freeDomainEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            {freeDomainEnabled && (
              <div className="space-y-2 ml-4">
                <label className="text-sm font-medium text-foreground/80">Free TLD Options</label>
                <p className="text-xs text-muted-foreground">Select which TLDs are available for free</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {COMMON_TLDS.map(tld => (
                    <button key={tld} type="button" onClick={() => toggleFreeTld(tld)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-mono font-medium border transition-all ${
                        freeDomainTlds.includes(tld)
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "bg-background border-border text-muted-foreground hover:border-primary/30"
                      }`}>
                      {tld}
                      {freeDomainTlds.includes(tld) && <CheckCircle size={11} className="inline ml-1.5 text-primary" />}
                    </button>
                  ))}
                </div>
                {freeDomainTlds.length === 0 && (
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertCircle size={11} /> Select at least one TLD to offer as free
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Selected: {freeDomainTlds.length === 0 ? "None" : freeDomainTlds.join(", ")}</p>
              </div>
            )}
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
            {loading ? "Saving…" : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setLocation("/admin/packages")} className="h-12 px-6">Cancel</Button>
        </div>
      </div>
    </motion.div>
  );
}
