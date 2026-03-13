import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import { Package, ArrowLeft, Loader2, Plus, X, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function EditPackage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "", description: "", price: "", billingCycle: "monthly",
    diskSpace: "", bandwidth: "", emailAccounts: "", databases: "", subdomains: "", ftpAccounts: "",
  });
  const [features, setFeatures] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedServerId, setSelectedServerId] = useState("");
  const [modulePlanId, setModulePlanId] = useState("");
  const [modulePlanName, setModulePlanName] = useState("");
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [serverPlans, setServerPlans] = useState<{ id: string; name: string }[]>([]);

  const { data: servers = [] } = useQuery<{ id: string; name: string; type: string }[]>({
    queryKey: ["admin-servers"], queryFn: () => apiFetch("/api/admin/servers"),
  });

  useEffect(() => {
    if (!selectedServerId) { setServerPlans([]); return; }
    setLoadingPlans(true);
    apiFetch(`/api/admin/servers/${selectedServerId}/plans`)
      .then(data => setServerPlans(data.plans || []))
      .catch(() => setServerPlans([]))
      .finally(() => setLoadingPlans(false));
  }, [selectedServerId]);

  useEffect(() => {
    apiFetch(`/api/admin/packages/${id}`)
      .then(data => {
        setForm({
          name: data.name || "",
          description: data.description || "",
          price: String(data.price || ""),
          billingCycle: data.billingCycle || "monthly",
          diskSpace: data.diskSpace || "",
          bandwidth: data.bandwidth || "",
          emailAccounts: String(data.emailAccounts || ""),
          databases: String(data.databases || ""),
          subdomains: String(data.subdomains || ""),
          ftpAccounts: String(data.ftpAccounts || ""),
        });
        setFeatures(data.features || []);
        if (data.modulePlanId) setModulePlanId(data.modulePlanId);
        if (data.modulePlanName) setModulePlanName(data.modulePlanName);
      })
      .catch(() => toast({ title: "Error", description: "Could not load package", variant: "destructive" }))
      .finally(() => setFetching(false));
  }, [id]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(err => ({ ...err, [field]: "" }));
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
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) e.price = "Valid price is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/packages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          emailAccounts: parseInt(form.emailAccounts) || 10,
          databases: parseInt(form.databases) || 5,
          subdomains: parseInt(form.subdomains) || 10,
          ftpAccounts: parseInt(form.ftpAccounts) || 5,
          features,
          modulePlanId: modulePlanId || null,
          modulePlanName: modulePlanName || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update package");
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast({ title: "Package updated", description: `${form.name} has been updated.` });
      setLocation("/admin/packages");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/packages")} className="rounded-xl">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Edit Package</h1>
          <p className="text-muted-foreground text-sm">Update hosting package details</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Package Details</h2>
              <p className="text-xs text-muted-foreground">Update pricing, resources, and features</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Package Name *</label>
                <Input value={form.name} onChange={set("name")} placeholder="Starter Plan" className={errors.name ? "border-destructive" : ""} />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Price ($) *</label>
                <Input type="number" step="0.01" min="0" value={form.price} onChange={set("price")} placeholder="9.99" className={errors.price ? "border-destructive" : ""} />
                {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Billing Cycle</label>
              <select value={form.billingCycle} onChange={set("billingCycle")} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div className="space-y-3 border border-border/50 rounded-xl p-4 bg-secondary/20">
              <div className="flex items-center gap-2 mb-1">
                <Server size={15} className="text-primary" />
                <label className="text-sm font-medium text-foreground/80">Module Plan Assignment</label>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">Link this package to a specific server plan for automated provisioning</p>

              {modulePlanId && (
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-sm">
                  <span className="text-primary font-medium">Current Plan:</span>
                  <span className="text-foreground">{modulePlanName || modulePlanId}</span>
                  <button type="button" onClick={() => { setModulePlanId(""); setModulePlanName(""); }}
                    className="ml-auto text-muted-foreground hover:text-destructive"><X size={14} /></button>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Select Server to load plans</label>
                <select value={selectedServerId} onChange={e => setSelectedServerId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">— Choose a Server —</option>
                  {servers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
                </select>
              </div>

              {selectedServerId && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Server Plans {loadingPlans && <span className="ml-1 text-primary">(loading…)</span>}
                  </label>
                  <select value={modulePlanId} disabled={loadingPlans}
                    onChange={e => {
                      const plan = serverPlans.find(p => p.id === e.target.value);
                      setModulePlanId(e.target.value);
                      setModulePlanName(plan?.name || "");
                    }}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50">
                    <option value="">— No plan selected —</option>
                    {serverPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {serverPlans.length === 0 && !loadingPlans && selectedServerId && (
                    <p className="text-xs text-muted-foreground">No plans found for this server (API credentials may be required)</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">Resources</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { field: "diskSpace", label: "Disk Space", placeholder: "10 GB" },
                  { field: "bandwidth", label: "Bandwidth", placeholder: "100 GB" },
                  { field: "emailAccounts", label: "Email Accounts", placeholder: "10" },
                  { field: "databases", label: "Databases", placeholder: "5" },
                  { field: "subdomains", label: "Subdomains", placeholder: "10" },
                  { field: "ftpAccounts", label: "FTP Accounts", placeholder: "5" },
                ].map(({ field, label, placeholder }) => (
                  <div key={field} className="space-y-1">
                    <label className="text-xs text-muted-foreground">{label}</label>
                    <Input value={form[field as keyof typeof form]} onChange={set(field)} placeholder={placeholder} className="h-9 text-sm" />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">Features</label>
              <div className="flex gap-2">
                <Input value={featureInput} onChange={(e) => setFeatureInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}
                  placeholder="e.g. Free SSL Certificate" className="flex-1" />
                <Button type="button" variant="outline" size="icon" onClick={addFeature} className="rounded-xl"><Plus size={16} /></Button>
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

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1 bg-primary hover:bg-primary/90">
                {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <Package size={18} className="mr-2" />}
                {loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setLocation("/admin/packages")}>Cancel</Button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
