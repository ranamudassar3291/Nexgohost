import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Package, Plus, ToggleLeft, ToggleRight, Trash2, Pencil, Server, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface HostingPlan {
  id: string; name: string; description: string | null; price: number;
  billingCycle: string; diskSpace: string; bandwidth: string;
  emailAccounts: number | null; databases: number | null; isActive: boolean; createdAt: string;
}

async function fetchPlans(): Promise<HostingPlan[]> {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/admin/packages", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to fetch packages");
  return res.json();
}

export default function Packages() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: plans = [], isLoading } = useQuery({ queryKey: ["admin-packages"], queryFn: fetchPlans });

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
          {plans.map((plan) => (
            <div key={plan.id} className={`bg-card border rounded-2xl p-5 space-y-4 transition-all ${plan.isActive ? "border-border" : "border-border/40 opacity-60"}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Server size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{plan.billingCycle}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${plan.isActive ? "bg-green-500/10 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {plan.isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  {plan.isActive ? "Active" : "Disabled"}
                </div>
              </div>

              <p className="text-2xl font-bold text-foreground">
                ${plan.price.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/{plan.billingCycle === "monthly" ? "mo" : "yr"}</span>
              </p>

              {plan.description && <p className="text-sm text-muted-foreground line-clamp-2">{plan.description}</p>}

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>💾 {plan.diskSpace}</span>
                <span>📶 {plan.bandwidth}</span>
                <span>📧 {plan.emailAccounts} emails</span>
                <span>🗄️ {plan.databases} DBs</span>
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
          ))}
        </div>
      )}
    </motion.div>
  );
}
