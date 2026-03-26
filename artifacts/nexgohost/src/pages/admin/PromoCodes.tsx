import { useState } from "react";
import { motion } from "framer-motion";
import {
  Tag, Plus, ToggleLeft, ToggleRight, Trash2, Loader2, CheckCircle, XCircle,
  AlertCircle, Percent, DollarSign, Layers, Globe, Package, Edit2, X, Calendar,
  Lock,
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
  billingCycleLock: "all" | "yearly" | "monthly";
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
  billingCycleLock: "all" as "all" | "yearly" | "monthly",
};

type FormState = typeof EMPTY_FORM;

// ── Shared promo code form ────────────────────────────────────────────────────
function PromoForm({
  form, setF, groups, domainTlds, plansForGroup, formError, onSubmit, submitting, submitLabel, onCancel,
}: {
  form: FormState;
  setF: (p: Partial<FormState>) => void;
  groups: ProductGroup[];
  domainTlds: DomainTld[];
  plansForGroup: HostingPlan[];
  formError: string;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const showDomainTld   = form.applicableTo === "domain"  || form.applicableTo === "all";
  const showHostingGroup = form.applicableTo === "hosting" || form.applicableTo === "all";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {formError && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
          <AlertCircle size={14}/>{formError}
        </div>
      )}

      {/* Code + description */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80">Promo Code *</label>
          <Input value={form.code} onChange={e => setF({ code: e.target.value.toUpperCase() })}
            placeholder="SAVE20" className="font-mono uppercase"/>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80">Description</label>
          <Input value={form.description} onChange={e => setF({ description: e.target.value })}
            placeholder="e.g. Summer Sale 2025"/>
        </div>
      </div>

      {/* Discount type toggle + value */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">Discount Type</label>
        <div className="flex gap-2 flex-wrap">
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

      {/* Billing Cycle Lock */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
          <Lock size={13} style={{ color: P }}/> Billing Cycle Restriction
        </label>
        <div className="flex gap-2 flex-wrap">
          {[
            { val: "all"     as const, label: "All Billing Cycles" },
            { val: "yearly"  as const, label: "Yearly Only (Salana)" },
            { val: "monthly" as const, label: "Monthly Only" },
          ].map(({ val, label }) => (
            <button type="button" key={val} onClick={() => setF({ billingCycleLock: val })}
              className="px-4 py-2 rounded-xl border text-sm font-medium transition-all"
              style={form.billingCycleLock === val
                ? { borderColor: P, background: `${P}10`, color: P }
                : { borderColor: "var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>
              {label}
            </button>
          ))}
        </div>
        {form.billingCycleLock !== "all" && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <Calendar size={11}/> This code will <strong>only work</strong> when client selects a{" "}
            <strong>{form.billingCycleLock === "yearly" ? "Yearly (Annual)" : "Monthly"}</strong> plan.
          </p>
        )}
      </div>

      {/* Scope */}
      <div className="space-y-3 p-4 bg-secondary/30 border border-border rounded-xl">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Layers size={14} className="text-primary"/> Discount Scope
          <span className="text-xs text-muted-foreground font-normal">(restrict where code applies)</span>
        </p>

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
          <Input type="number" min="1" value={form.usageLimit}
            onChange={e => setF({ usageLimit: e.target.value })} placeholder="Unlimited"/>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80">Expiry Date</label>
          <Input type="date" value={form.expiresAt}
            onChange={e => setF({ expiresAt: e.target.value })}
            min={new Date().toISOString().split("T")[0]}/>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={submitting} style={{ background: P }} className="text-white">
          {submitting && <Loader2 size={16} className="animate-spin mr-1"/>}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        )}
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PromoCodes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: codes = [], isLoading } = useQuery({ queryKey: ["admin-promo-codes"], queryFn: fetchCodes });
  const { data: groups = [] } = useQuery({ queryKey: ["admin-product-groups"], queryFn: fetchGroups });
  const { data: domainTlds = [] } = useQuery({ queryKey: ["admin-promo-domain-tlds"], queryFn: fetchDomainTlds });

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [editForm,   setEditForm]   = useState(EMPTY_FORM);
  const [creating,   setCreating]   = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [createError, setCreateError] = useState("");
  const [editError,   setEditError]   = useState("");

  const setC = (p: Partial<FormState>) => setCreateForm(f => ({ ...f, ...p }));
  const setE = (p: Partial<FormState>) => setEditForm(f => ({ ...f, ...p }));

  const { data: createPlans = [] } = useQuery({
    queryKey: ["promo-plans-create", createForm.applicableGroupId],
    queryFn: () => fetchPlansForGroup(createForm.applicableGroupId),
    enabled: !!createForm.applicableGroupId,
  });
  const { data: editPlans = [] } = useQuery({
    queryKey: ["promo-plans-edit", editForm.applicableGroupId],
    queryFn: () => fetchPlansForGroup(editForm.applicableGroupId),
    enabled: !!editForm.applicableGroupId,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/promo-codes/${id}/toggle`, { method: "POST", headers: authH() }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE", headers: authH() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] }); toast({ title: "Promo code deleted" }); },
  });

  function startEdit(c: PromoCode) {
    setEditForm({
      code: c.code,
      description: c.description ?? "",
      discountType: c.discountType,
      discountPercent: String(c.discountPercent || ""),
      fixedAmount: c.fixedAmount != null ? String(c.fixedAmount) : "",
      usageLimit: c.usageLimit != null ? String(c.usageLimit) : "",
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
      applicableTo: c.applicableTo || "all",
      applicableGroupId: c.applicableGroupId ?? "",
      applicablePlanId: c.applicablePlanId ?? "",
      applicableDomainTld: c.applicableDomainTld ?? "",
      billingCycleLock: (c.billingCycleLock as any) || "all",
    });
    setEditError("");
    setEditingId(c.id);
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!createForm.code.trim()) { setCreateError("Code is required"); return; }
    if (createForm.discountType === "percent") {
      const pct = parseInt(createForm.discountPercent);
      if (isNaN(pct) || pct < 1 || pct > 100) { setCreateError("Discount % must be between 1 and 100"); return; }
    } else {
      const amt = parseFloat(createForm.fixedAmount);
      if (isNaN(amt) || amt <= 0) { setCreateError("Fixed amount must be a positive number"); return; }
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: authH(),
        body: JSON.stringify({
          code: createForm.code.toUpperCase(),
          description: createForm.description || undefined,
          discountType: createForm.discountType,
          discountPercent: createForm.discountType === "percent" ? parseInt(createForm.discountPercent) : 0,
          fixedAmount: createForm.discountType === "fixed" ? parseFloat(createForm.fixedAmount) : undefined,
          usageLimit: createForm.usageLimit ? parseInt(createForm.usageLimit) : undefined,
          expiresAt: createForm.expiresAt || undefined,
          applicableTo: createForm.applicableTo || "all",
          applicableGroupId: createForm.applicableGroupId || undefined,
          applicablePlanId: createForm.applicablePlanId || undefined,
          applicableDomainTld: createForm.applicableDomainTld || undefined,
          billingCycleLock: createForm.billingCycleLock || "all",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
      toast({ title: "Promo code created", description: data.code });
      setCreateForm(EMPTY_FORM);
      setShowCreate(false);
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setEditError("");
    if (editForm.discountType === "percent") {
      const pct = parseInt(editForm.discountPercent);
      if (isNaN(pct) || pct < 1 || pct > 100) { setEditError("Discount % must be between 1 and 100"); return; }
    } else {
      const amt = parseFloat(editForm.fixedAmount);
      if (isNaN(amt) || amt <= 0) { setEditError("Fixed amount must be a positive number"); return; }
    }
    setEditing(true);
    try {
      const res = await fetch(`/api/admin/promo-codes/${editingId}`, {
        method: "PATCH",
        headers: authH(),
        body: JSON.stringify({
          description: editForm.description || undefined,
          discountType: editForm.discountType,
          discountPercent: editForm.discountType === "percent" ? parseInt(editForm.discountPercent) : 0,
          fixedAmount: editForm.discountType === "fixed" ? parseFloat(editForm.fixedAmount) : undefined,
          usageLimit: editForm.usageLimit ? parseInt(editForm.usageLimit) : null,
          expiresAt: editForm.expiresAt || null,
          applicableTo: editForm.applicableTo || "all",
          applicableGroupId: editForm.applicableGroupId || null,
          applicablePlanId: editForm.applicablePlanId || null,
          applicableDomainTld: editForm.applicableDomainTld || null,
          billingCycleLock: editForm.billingCycleLock || "all",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
      toast({ title: "Promo code updated", description: data.code });
      setEditingId(null);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditing(false);
    }
  };

  function discountBadge(c: PromoCode) {
    if (c.discountType === "fixed") {
      return <span className="px-2 py-1 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg text-sm font-semibold whitespace-nowrap">Rs. {c.fixedAmount?.toFixed(0)} OFF</span>;
    }
    return <span className="px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm font-semibold">-{c.discountPercent}%</span>;
  }

  function cycleBadge(c: PromoCode) {
    if (c.billingCycleLock === "yearly")  return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">Yearly Only</span>;
    if (c.billingCycleLock === "monthly") return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">Monthly Only</span>;
    return null;
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

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Promo Codes</h1>
          <p className="text-muted-foreground text-sm">{codes.length} code{codes.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => { setShowCreate(!showCreate); setEditingId(null); }} className="gap-2" style={{ background: P }}>
          <Plus size={18} /> Create Code
        </Button>
      </div>

      {/* ── Create Form ── */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-primary/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-foreground">Create Promo Code</h2>
            <button onClick={() => { setShowCreate(false); setCreateForm(EMPTY_FORM); setCreateError(""); }}
              className="text-muted-foreground hover:text-foreground"><X size={16}/></button>
          </div>
          <PromoForm
            form={createForm} setF={setC}
            groups={groups} domainTlds={domainTlds} plansForGroup={createPlans}
            formError={createError}
            onSubmit={handleCreate} submitting={creating} submitLabel="Create Code"
            onCancel={() => { setShowCreate(false); setCreateForm(EMPTY_FORM); setCreateError(""); }}
          />
        </motion.div>
      )}

      {/* ── Edit Form ── */}
      {editingId && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-amber-500/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Edit2 size={15} style={{ color: P }}/> Editing: <span className="font-mono" style={{ color: P }}>{editForm.code}</span>
            </h2>
            <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X size={16}/></button>
          </div>
          <PromoForm
            form={editForm} setF={setE}
            groups={groups} domainTlds={domainTlds} plansForGroup={editPlans}
            formError={editError}
            onSubmit={handleEdit} submitting={editing} submitLabel="Save Changes"
            onCancel={() => { setEditingId(null); setEditError(""); }}
          />
        </motion.div>
      )}

      {/* ── Table ── */}
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
              {["Code", "Discount", "Cycle", "Scope", "Usage", "Expires", "Status", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {codes.map((c, i) => (
                <tr key={c.id} className={`border-b border-border/30 hover:bg-secondary/20 transition-colors ${i === codes.length - 1 ? "border-0" : ""} ${editingId === c.id ? "bg-amber-500/5" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-mono font-bold text-primary">{c.code}</p>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                  </td>
                  <td className="px-4 py-3">{discountBadge(c)}</td>
                  <td className="px-4 py-3">{cycleBadge(c) ?? <span className="text-xs text-muted-foreground">All</span>}</td>
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
                      <Button size="sm" variant="ghost"
                        onClick={() => { setShowCreate(false); editingId === c.id ? setEditingId(null) : startEdit(c); }}
                        className={`h-7 px-2 ${editingId === c.id ? "text-amber-500" : ""}`}
                        title="Edit">
                        <Edit2 size={13}/>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate(c.id)} className="h-7 px-2" title="Toggle active">
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
