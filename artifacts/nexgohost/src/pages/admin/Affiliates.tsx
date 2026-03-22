import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, DollarSign, Check, X, Settings, Loader2, AlertCircle, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/context/CurrencyProvider";

const token = () => localStorage.getItem("token") || "";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...opts?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    suspended: "bg-red-500/10 text-red-400 border-red-500/20",
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    approved: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    paid: "bg-green-500/10 text-green-400 border-green-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${map[status] || "bg-secondary text-muted-foreground border-transparent"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

type Tab = "affiliates" | "commissions";

export default function Affiliates() {
  const { formatPrice } = useCurrency();
  const [tab, setTab] = useState<Tab>("affiliates");
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [aff, comm] = await Promise.all([
        apiFetch("/api/admin/affiliates"),
        apiFetch("/api/admin/affiliates/commissions/all"),
      ]);
      setAffiliates(aff.affiliates || []);
      setCommissions(comm.commissions || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveAffiliate = async (id: string) => {
    setSaving(id);
    try {
      await apiFetch(`/api/admin/affiliates/${id}`, {
        method: "PUT",
        body: JSON.stringify(editValues[id] || {}),
      });
      await load();
      setExpandedId(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(null);
    }
  };

  const approveCommission = async (id: string) => {
    setActioning(id);
    try {
      await apiFetch(`/api/admin/affiliates/commissions/${id}/approve`, { method: "PUT" });
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActioning(null);
    }
  };

  const payCommission = async (id: string) => {
    setActioning(id);
    try {
      await apiFetch(`/api/admin/affiliates/commissions/${id}/pay`, { method: "PUT" });
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActioning(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (error) {
    return <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive"><AlertCircle size={18} /> {error}</div>;
  }

  const totalEarnings = affiliates.reduce((s, a) => s + parseFloat(a.totalEarnings || "0"), 0);
  const totalPending = affiliates.reduce((s, a) => s + parseFloat(a.pendingEarnings || "0"), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Affiliate Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage affiliates, commissions, and payouts</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Affiliates", value: affiliates.length, icon: Users, color: "text-blue-400" },
          { label: "Active", value: affiliates.filter(a => a.status === "active").length, icon: TrendingUp, color: "text-green-400" },
          { label: "Total Commissions", value: formatPrice(totalEarnings), icon: DollarSign, color: "text-yellow-400" },
          { label: "Pending Payout", value: formatPrice(totalPending), icon: DollarSign, color: "text-orange-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={16} className={s.color} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <div className="text-2xl font-display font-bold text-foreground">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 w-fit">
        {(["affiliates", "commissions"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "affiliates" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {affiliates.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">No affiliates yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {affiliates.map(a => (
                <div key={a.id}>
                  <div className="p-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{a.firstName} {a.lastName}</span>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{a.email} · Code: <span className="font-mono text-foreground">{a.referralCode}</span></p>
                    </div>
                    <div className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="text-center">
                        <div className="font-bold text-foreground">{a.totalClicks}</div>
                        <div className="text-xs">Clicks</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-foreground">{a.totalSignups}</div>
                        <div className="text-xs">Signups</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-green-400">{formatPrice(parseFloat(a.totalEarnings || "0"))}</div>
                        <div className="text-xs">Earnings</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setExpandedId(expandedId === a.id ? null : a.id);
                      if (!editValues[a.id]) setEditValues(ev => ({ ...ev, [a.id]: { status: a.status, commissionType: a.commissionType, commissionValue: a.commissionValue } }));
                    }}>
                      {expandedId === a.id ? <ChevronUp size={16} /> : <Settings size={16} />}
                    </Button>
                  </div>

                  {expandedId === a.id && (
                    <div className="p-4 bg-secondary/20 border-t border-border space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Status</label>
                          <select
                            value={editValues[a.id]?.status || a.status}
                            onChange={e => setEditValues(ev => ({ ...ev, [a.id]: { ...ev[a.id], status: e.target.value } }))}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Commission Type</label>
                          <select
                            value={editValues[a.id]?.commissionType || a.commissionType}
                            onChange={e => setEditValues(ev => ({ ...ev, [a.id]: { ...ev[a.id], commissionType: e.target.value } }))}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                            <option value="percentage">Percentage (%)</option>
                            <option value="fixed">Fixed Amount</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Commission Value</label>
                          <Input
                            type="number" step="0.01" min="0"
                            value={editValues[a.id]?.commissionValue ?? a.commissionValue}
                            onChange={e => setEditValues(ev => ({ ...ev, [a.id]: { ...ev[a.id], commissionValue: e.target.value } }))}
                            className="bg-background border-border"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveAffiliate(a.id)} disabled={saving === a.id} className="gap-1">
                          {saving === a.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setExpandedId(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "commissions" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {commissions.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">No commissions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3">Affiliate</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {commissions.map((c: any) => (
                    <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-medium text-foreground">{c.firstName} {c.lastName}</div>
                        <div className="text-xs text-muted-foreground">{c.referralCode}</div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{c.description || "Commission"}</td>
                      <td className="px-5 py-3 font-bold text-green-400">{formatPrice(parseFloat(c.amount))}</td>
                      <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          {c.status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => approveCommission(c.id)} disabled={actioning === c.id} className="gap-1 text-xs h-7">
                              {actioning === c.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Approve
                            </Button>
                          )}
                          {c.status === "approved" && (
                            <Button size="sm" onClick={() => payCommission(c.id)} disabled={actioning === c.id} className="gap-1 text-xs h-7">
                              {actioning === c.id ? <Loader2 size={10} className="animate-spin" /> : <DollarSign size={10} />} Mark Paid
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
