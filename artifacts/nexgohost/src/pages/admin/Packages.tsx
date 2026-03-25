import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Package, Plus, ToggleLeft, ToggleRight, Trash2, Pencil, Server, CheckCircle, XCircle, Loader2, Tag, Link2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrency } from "@/context/CurrencyProvider";

interface ProductGroup { id: string; name: string; }

interface HostingPlan {
  id: string; name: string; description: string | null;
  groupId: string | null;
  price: number; yearlyPrice: number | null; quarterlyPrice: number | null; semiannualPrice: number | null;
  billingCycle: string; diskSpace: string; bandwidth: string;
  emailAccounts: number | null; databases: number | null; isActive: boolean; createdAt: string;
}

async function fetchPlans(): Promise<HostingPlan[]> {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/admin/packages", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to fetch packages");
  return res.json();
}

async function fetchGroups(): Promise<ProductGroup[]> {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/admin/product-groups", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  return res.json();
}

export default function Packages() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyOrderLink(planId: string) {
    const link = `${window.location.origin}/order?plan=${planId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(planId);
      toast({ title: "Order link copied", description: link });
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const { data: plans = [], isLoading } = useQuery({ queryKey: ["admin-packages"], queryFn: fetchPlans });
  const { data: groups = [] } = useQuery({ queryKey: ["admin-product-groups"], queryFn: fetchGroups });

  const groupMap = Object.fromEntries(groups.map(g => [g.id, g.name]));

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/packages/${id}/toggle`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to toggle");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-packages"] }),
    onError: () => toast({ title: "Error", description: "Failed to update package", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/packages/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-packages"] }); toast({ title: "Package deleted" }); },
    onError: () => toast({ title: "Error", description: "Failed to delete package", variant: "destructive" }),
  });

  const priceTiers = (plan: HostingPlan) => {
    const tiers: { label: string; price: number | null; suffix: string }[] = [
      { label: "Monthly", price: plan.price, suffix: "/mo" },
      { label: "Quarterly", price: plan.quarterlyPrice, suffix: "/qtr" },
      { label: "Semiannual", price: plan.semiannualPrice, suffix: "/6mo" },
      { label: "Yearly", price: plan.yearlyPrice, suffix: "/yr" },
    ];
    return tiers.filter(t => t.price !== null && t.price !== undefined);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Packages</h1>
          <p className="text-muted-foreground text-sm">{plans.length} hosting package{plans.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setLocation("/admin/packages/add")} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus size={18} /> Add Package
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-center bg-card border border-border rounded-2xl">
          <Package size={32} className="text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No packages yet.</p>
          <Button className="mt-3 gap-2" onClick={() => setLocation("/admin/packages/add")}><Plus size={16} />Create your first package</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const tiers = priceTiers(plan);
            const lowestTier = tiers[0];
            return (
              <div key={plan.id} className={`bg-card border rounded-2xl p-5 space-y-4 transition-all ${plan.isActive ? "border-border" : "border-border/40 opacity-60"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Server size={18} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{plan.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {plan.groupId && groupMap[plan.groupId] ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            <Tag size={8} /> {groupMap[plan.groupId]}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60">No group</span>
                        )}
                        <span className="text-xs text-muted-foreground">{tiers.length} billing option{tiers.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${plan.isActive ? "bg-green-500/10 text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {plan.isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {plan.isActive ? "Active" : "Disabled"}
                  </div>
                </div>

                {lowestTier && (
                  <p className="text-2xl font-bold text-foreground">
                    {formatPrice(lowestTier.price!)}
                    <span className="text-sm font-normal text-muted-foreground">{lowestTier.suffix}</span>
                  </p>
                )}

                {tiers.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tiers.slice(1).map(t => (
                      <span key={t.label} className="text-xs px-2 py-0.5 rounded-full bg-primary/5 border border-primary/20 text-primary/80">
                        {formatPrice(t.price!)}{t.suffix}
                      </span>
                    ))}
                  </div>
                )}

                {plan.description && <p className="text-sm text-muted-foreground line-clamp-2">{plan.description}</p>}

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>💾 {plan.diskSpace}</span>
                  <span>📶 {plan.bandwidth}</span>
                  <span>📧 {plan.emailAccounts} emails</span>
                  <span>🗄️ {plan.databases} DBs</span>
                </div>

                {/* Order link */}
                <div className="flex items-center gap-2 p-2 bg-secondary/40 rounded-lg border border-border/50">
                  <Link2 size={12} className="text-muted-foreground shrink-0" />
                  <code className="text-[10px] text-muted-foreground truncate flex-1">/order?plan={plan.id.slice(0, 12)}…</code>
                  <Button size="sm" variant="ghost" onClick={() => copyOrderLink(plan.id)} className="h-6 px-2 text-xs gap-1 shrink-0">
                    {copiedId === plan.id ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                    {copiedId === plan.id ? "Copied" : "Copy"}
                  </Button>
                </div>

                <div className="flex gap-2 pt-1 border-t border-border/50">
                  <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate(plan.id)} className="flex-1 gap-1.5 text-xs">
                    {plan.isActive ? <ToggleRight size={14} className="text-green-400" /> : <ToggleLeft size={14} />}
                    {plan.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setLocation(`/admin/packages/${plan.id}/edit`)} className="text-xs gap-1.5">
                    <Pencil size={14} /> Edit
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => { if (confirm("Delete this package?")) deleteMutation.mutate(plan.id); }}
                    className="text-xs text-destructive hover:text-destructive gap-1.5"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
