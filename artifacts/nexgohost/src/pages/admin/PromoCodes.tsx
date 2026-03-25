import { useState } from "react";
import { motion } from "framer-motion";
import {
  Tag, Plus, ToggleLeft, ToggleRight, Trash2, Loader2, CheckCircle, XCircle,
  AlertCircle, Percent, DollarSign, Layers, Globe, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const P = "#701AFE";

interface ProductGroup { id: string; name: string; }
interface HostingPlan { id: string; name: string; price: number; }
interface DomainTld { id: string; tld: string; price: number; }
interface PromoCode {
  id: string; code: string; description: string | null;
  discountType: "percent" | "fixed";
  discountPercent: number; fixedAmount: number | null;
  isActive: boolean; usageLimit: number | null; usedCount: number; expiresAt: string | null;
  applicableTo: string;
  applicableGroupId: string | null; applicableGroupName: string | null;
  applicableDomainTld: string | null;
  applicablePlanId: string | null; applicablePlanName: string | null;
  createdAt: string;
}

const token = () => localStorage.getItem("token") ?? "";
const authH = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

async function fetchCodes(): Promise<PromoCode[]> {
  const res = await fetch("/api/admin/promo-codes", { headers: authH() });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}
async function fetchGroups(): Promise<ProductGroup[]> {
  const res = await fetch("/api/admin/product-groups", { headers: authH() });
  if (!res.ok) return [];
  return res.json();
}
async function fetchPlansForGroup(groupId: string): Promise<HostingPlan[]> {
  if (!groupId) return [];
  const res = await fetch(`/api/admin/promo-codes/plans-for-group/${groupId}`, { headers: authH() });
  if (!res.ok) return [];
  return res.json();
}
async function fetchDomainTlds(): Promise<DomainTld[]> {
  const res = await fetch("/api/admin/promo-codes/domain-tlds", { headers: authH() });
  if (!res.ok) return [];
  return res.json();
}

const EMPTY_FORM = {
  code: "", description: "",
  discountType: "percent" as "percent" | "fixed",
  discountPercent: "", fixedAmount: "",
  usageLimit: "", expiresAt: "",
  applicableTo: "all",
  applicableGroupId: "",
  applicablePlanId: "",
  applicableDomainTld: "",
};

export default function PromoCodes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: codes = [], isLoading } = useQuery({ queryKey: ["admin-promo-codes"], queryFn: fetchCodes });
  const { data: groups = [] } = useQuery({ queryKey: ["admin-product-groups"], queryFn: fetchGroups });
  const { data: domainTlds = [] } = useQuery({ queryKey: ["admin-promo-domain-tlds"], queryFn: fetchDomainTlds });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");

  const setF = (partial: Partial<typeof EMPTY_FORM>) => setForm(f => ({ ...f, ...partial }));

  // Fetch plans for selected group
  const { data: plansForGroup = [] } = useQuery({
    queryKey: ["promo-plans-group", form.applicableGroupId],
    queryFn: () => fetchPlansForGroup(form.applicableGroupId),
    enabled: !!form.applicableGroupId,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/promo-codes/${id}/toggle`, { method: "POST", headers: authH() }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE", headers: authH() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] }); toast({ title: "Promo code deleted" }); },
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.code.trim()) { setFormError("Code is required"); return; }
    if (form.discountType === "percent") {
      const pct = parseInt(form.discountPercent);
      if (isNaN(pct) || pct < 1 || pct > 100) { setFormError("Discount % must be between 1 and 100"); return; }
    } else {
      const amt = parseFloat(form.fixedAmount);
      if (isNaN(amt) || amt <= 0) { setFormError("Fixed amount must be a positive number"); return; }
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: authH(),
        body: JSON.stringify({
          code: form.code.toUpperCase(),
          description: form.description || undefined,
          discountType: form.discountType,
          discountPercent: form.discountType === "percent" ? parseInt(form.discountPercent) : 0,
          fixedAmount: form.discountType === "fixed" ? parseFloat(form.fixedAmount) : undefined,
          usageLimit: form.usageLimit ? parseInt(form.usageLimit) : undefined,
          expiresAt: form.expiresAt || undefined,
          applicableTo: form.applicableTo || "all",
          applicableGroupId: form.applicableGroupId || undefined,
          applicablePlanId: form.applicablePlanId || undefined,
          applicableDomainTld: form.applicableDomainTld || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
      toast({ title: "Promo code created", description: data.code });
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setAdding(false);
    }
  };

  function discountBadge(c: PromoCode) {
    if (c.discountType === "fixed") {
      return <span className="px-2 py-1 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg text-sm font-semibold whitespace-nowrap">Rs. {c.fixedAmount?.toFixed(0)} OFF</span>;
    }
    return <span className="px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm font-semibold">-{c.discountPercent}%</span>;
  }

  function scopeBadge(c: PromoCode) {
    const parts: string[] = [];
    if (c.applicableTo !== "all") parts.push(c.applicableTo === "hosting" ? "🖥 Hosting" : "🌐 Domains");
    if (c.applicableGroupName) parts.push(c.applicableGroupName);
    if (c.applicablePlanName) parts.push(`Plan: ${c.applicablePlanName}`);
    if (c.applicableDomainTld) parts.push(c.applicableDomainTld);
    if (parts.length === 0) return <span className="px-2 py-1 rounded-lg text-xs font-medium border bg-secondary border-border text-muted-foreground">All</span>;
    return (
      <div className="flex flex-col gap-0.5">
        {parts.map((p, i) => (
          <span key={i} className="px-2 py-0.5 rounded-lg text-xs font-medium border bg-blue-500/10 border-blue-500/20 text-blue-400 w-fit">{p}</span>
        ))}
      </div>
    );
  }

  const showDomainTld = form.applicableTo === "domain" || form.applicableTo === "all";
  const showHostingGroup = form.applicableTo === "hosting" || form.applicableTo === "all";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Promo Codes</h1>
          <p className="text-muted-foreground text-sm">{codes.length} code{codes.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2" style={{ background: P }}>
          <Plus size={18} /> Create Code
        </Button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-primary/20 rounded-2xl p-6">
          <h2 className="font-semibold text-foreground mb-5">Create Promo Code</h2>
          {formError && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
              <AlertCircle size={14}/>{formError}
            </div>
          )}
          <form onSubmit={handleAdd} className="space-y-5">
            {/* Code + description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Promo Code *</label>
                <Input value={form.code} onChange={e => setF({ code: e.target.value.toUpperCase() })} placeholder="SAVE20" className="font-mono uppercase"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Description</label>
                <Input value={form.description} onChange={e => setF({ description: e.target.value })} placeholder="e.g. Summer Sale 2025"/>
              </div>
            </div>

            {/* Discount type toggle + value */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">Discount Type</label>
              <div className="flex gap-2">
                {[
                  { val: "percent" as const, label: "Percentage (%)", Icon: Percent },
                  { val: "fixed"   as const, label: "Fixed Amount (PKR)", Icon: DollarSign },
                ].map(({ val, label, Icon }) => (
                  <button type="button" key={val} onClick={() => setF({ discountType: val })}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all"
                    style={form.discountType === val
                      ? { borderColor: P, background: `${P}10`, color: P }
                      : { borderColor: "var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>
                    <Icon size={14}/>{label}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                {form.discountType === "percent" ? (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Discount Percentage (1–100) *</label>
                    <div className="relative max-w-[200px]">
                      <Input type="number" min="1" max="100" value={form.discountPercent}
                        onChange={e => setF({ discountPercent: e.target.value })} placeholder="20"/>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">%</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Fixed Discount Amount (PKR) *</label>
                    <div className="relative max-w-[200px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">Rs.</span>
                      <Input type="number" min="1" value={form.fixedAmount}
                        onChange={e => setF({ fixedAmount: e.target.value })} placeholder="500" className="pl-10"/>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Scope */}
            <div className="space-y-3 p-4 bg-secondary/30 border border-border rounded-xl">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Layers size={14} className="text-primary"/> Discount Scope
                <span className="text-xs text-muted-foreground font-normal">(restrict where code applies)</span>
              </p>

              {/* Applies To */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Applies To</label>
                <select value={form.applicableTo}
                  onChange={e => setF({ applicableTo: e.target.value, applicableGroupId: "", applicablePlanId: "", applicableDomainTld: "" })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary/30 outline-none max-w-[200px]">
                  <option value="all">All Services</option>
                  <option value="hosting">Hosting Only</option>
                  <option value="domain">Domains Only</option>
                </select>
              </div>

              {/* Hosting group + plan (shown when hosting or all) */}
              {showHostingGroup && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Layers size={11}/> Hosting Group</label>
                    <select value={form.applicableGroupId}
                      onChange={e => setF({ applicableGroupId: e.target.value, applicablePlanId: "" })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary/30 outline-none">
                      <option value="">All Groups</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>

                  {/* Specific plan dropdown (shown only when a group is selected) */}
                  {form.applicableGroupId && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Package size={11}/> Specific Plan</label>
                      <select value={form.applicablePlanId}
                        onChange={e => setF({ applicablePlanId: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary/30 outline-none">
                        <option value="">All Plans in Group</option>
                        {plansForGroup.map(p => (
                          <option key={p.id} value={p.id}>{p.name} — Rs. {p.price.toLocaleString()}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Domain TLD dropdown (shown when domain or all) */}
              {showDomainTld && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Globe size={11}/> Domain Extension</label>
                  <select value={form.applicableDomainTld}
                    onChange={e => setF({ applicableDomainTld: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary/30 outline-none max-w-[260px]">
                    <option value="">All Extensions</option>
                    {domainTlds.map(t => (
                      <option key={t.id} value={t.tld}>{t.tld} — Rs. {t.price.toLocaleString()}/yr</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Usage limits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Total Usage Limit</label>
                <Input type="number" min="1" value={form.usageLimit} onChange={e => setF({ usageLimit: e.target.value })} placeholder="Unlimited"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Expiry Date</label>
                <Input type="date" value={form.expiresAt} onChange={e => setF({ expiresAt: e.target.value })} min={new Date().toISOString().split("T")[0]}/>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={adding} style={{ background: P }} className="text-white">
                {adding ? <Loader2 size={16} className="animate-spin mr-1"/> : null} Create Code
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(""); }}>Cancel</Button>
            </div>
          </form>
        </motion.div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-primary" size={32}/></div>
      ) : codes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 bg-card border border-border rounded-2xl text-center">
          <Tag size={32} className="text-muted-foreground mb-2"/>
          <p className="text-muted-foreground">No promo codes yet.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border/50 bg-secondary/30">
              {["Code", "Discount", "Scope", "Usage", "Expires", "Status", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {codes.map((c, i) => (
                <tr key={c.id} className={`border-b border-border/30 hover:bg-secondary/20 transition-colors ${i === codes.length - 1 ? "border-0" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-mono font-bold text-primary">{c.code}</p>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                  </td>
                  <td className="px-4 py-3">{discountBadge(c)}</td>
                  <td className="px-4 py-3">{scopeBadge(c)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : " / ∞"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full w-fit border ${c.isActive ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-muted text-muted-foreground border-border"}`}>
                      {c.isActive ? <CheckCircle size={10}/> : <XCircle size={10}/>}
                      {c.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate(c.id)} className="h-7 px-2">
                        {c.isActive ? <ToggleRight size={14} className="text-green-400"/> : <ToggleLeft size={14}/>}
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => { if (confirm("Delete this promo code?")) deleteMutation.mutate(c.id); }}
                        className="text-destructive hover:text-destructive h-7 px-2">
                        <Trash2 size={13}/>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
