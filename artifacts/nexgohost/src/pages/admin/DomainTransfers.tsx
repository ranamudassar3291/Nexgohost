import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Globe, CheckCircle2, XCircle, Loader2, AlertCircle, Clock, Eye, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/context/CurrencyProvider";
import { apiFetch } from "@/lib/api";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Pending" },
    validating: { cls: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Validating" },
    approved: { cls: "bg-green-500/10 text-green-400 border-green-500/20", label: "Approved" },
    rejected: { cls: "bg-red-500/10 text-red-400 border-red-500/20", label: "Rejected" },
    completed: { cls: "bg-green-500/10 text-green-400 border-green-500/20", label: "Completed" },
    cancelled: { cls: "bg-secondary text-muted-foreground border-transparent", label: "Cancelled" },
  };
  const s = map[status] || { cls: "bg-secondary text-muted-foreground border-transparent", label: status };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function DomainTransfers() {
  const { formatPrice } = useCurrency();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/domain-transfers");
      setTransfers(data.transfers || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    setActioning(id);
    try {
      await apiFetch(`/api/admin/domain-transfers/${id}/approve`, {
        method: "PUT",
        body: JSON.stringify({ adminNotes: adminNotes[id] || "" }),
      });
      await load();
      setExpandedId(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActioning(null);
    }
  };

  const reject = async (id: string) => {
    setActioning(id);
    try {
      await apiFetch(`/api/admin/domain-transfers/${id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ adminNotes: adminNotes[id] || "" }),
      });
      await load();
      setExpandedId(null);
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

  const pending = transfers.filter(t => t.status === "pending" || t.status === "validating");
  const completed = transfers.filter(t => t.status === "approved" || t.status === "rejected" || t.status === "completed");

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Domain Transfers</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Review and approve incoming domain transfer requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Requests", value: transfers.length, icon: Globe },
          { label: "Pending Review", value: pending.length, icon: Clock },
          { label: "Approved", value: transfers.filter(t => t.status === "approved" || t.status === "completed").length, icon: CheckCircle2 },
          { label: "Rejected", value: transfers.filter(t => t.status === "rejected").length, icon: XCircle },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={16} className="text-primary" />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <div className="text-2xl font-display font-bold text-foreground">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Pending transfers */}
      {pending.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Clock size={16} className="text-yellow-400" /> Pending Review ({pending.length})
            </h2>
          </div>
          <div className="divide-y divide-border">
            {pending.map((t: any) => (
              <div key={t.id}>
                <div className="p-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <Globe size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{t.domainName}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">{t.firstName} {t.lastName} · {t.email}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="font-medium text-foreground">{formatPrice(parseFloat(t.price || "10"))}</div>
                    <div className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</div>
                  </div>
                  <ChevronDown size={16} className={`text-muted-foreground transition-transform ${expandedId === t.id ? "rotate-180" : ""}`} />
                </div>

                {expandedId === t.id && (
                  <div className="p-5 bg-secondary/20 border-t border-border space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Domain</span>
                        <p className="font-medium text-foreground">{t.domainName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">EPP Code</span>
                        <p className="font-medium text-foreground font-mono text-sm">{t.epp}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Client</span>
                        <p className="font-medium text-foreground">{t.firstName} {t.lastName}</p>
                        <p className="text-xs text-muted-foreground">{t.email}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Validation</span>
                        <p className="text-sm text-foreground">{t.validationMessage || "—"}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Admin Notes (optional)</label>
                      <textarea
                        value={adminNotes[t.id] || ""}
                        onChange={e => setAdminNotes(n => ({ ...n, [t.id]: e.target.value }))}
                        rows={2}
                        placeholder="Internal notes..."
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => approve(t.id)} disabled={actioning === t.id} className="gap-2 bg-green-600 hover:bg-green-700">
                        {actioning === t.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve
                      </Button>
                      <Button variant="outline" onClick={() => reject(t.id)} disabled={actioning === t.id} className="gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10">
                        {actioning === t.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed transfers */}
      {completed.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-semibold text-foreground">Completed ({completed.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3">Domain</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {completed.map((t: any) => (
                  <tr key={t.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{t.domainName}</td>
                    <td className="px-5 py-3">
                      <div className="text-foreground">{t.firstName} {t.lastName}</div>
                      <div className="text-xs text-muted-foreground">{t.email}</div>
                    </td>
                    <td className="px-5 py-3 text-foreground">{formatPrice(parseFloat(t.price || "10"))}</td>
                    <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {transfers.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <Globe size={40} className="text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium text-foreground mb-1">No Transfer Requests</h3>
          <p className="text-sm text-muted-foreground">Domain transfer requests will appear here when clients submit them.</p>
        </div>
      )}
    </motion.div>
  );
}
