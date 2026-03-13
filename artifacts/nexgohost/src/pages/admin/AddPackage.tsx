import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Package, ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function AddPackage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "", description: "", price: "", billingCycle: "monthly",
    diskSpace: "10 GB", bandwidth: "100 GB",
    emailAccounts: "10", databases: "5", subdomains: "10", ftpAccounts: "5",
  });
  const [features, setFeatures] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      const res = await fetch("/api/admin/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          emailAccounts: parseInt(form.emailAccounts),
          databases: parseInt(form.databases),
          subdomains: parseInt(form.subdomains),
          ftpAccounts: parseInt(form.ftpAccounts),
          features,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create package");
      queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      toast({ title: "Package created", description: `${form.name} is now available.` });
      setLocation("/admin/packages");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/packages")} className="rounded-xl">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Add Package</h1>
          <p className="text-muted-foreground text-sm">Create a new hosting package</p>
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
              <p className="text-xs text-muted-foreground">Define pricing, resources, and features</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name + Price */}
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

            {/* Billing Cycle */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Billing Cycle</label>
              <select value={form.billingCycle} onChange={set("billingCycle")} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this package..."
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            {/* Resources */}
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

            {/* Features */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">Features</label>
              <div className="flex gap-2">
                <Input
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}
                  placeholder="e.g. Free SSL Certificate"
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addFeature} className="rounded-xl">
                  <Plus size={16} />
                </Button>
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
                {loading ? "Creating..." : "Create Package"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setLocation("/admin/packages")}>Cancel</Button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
