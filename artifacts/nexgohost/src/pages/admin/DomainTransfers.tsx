import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Globe, CheckCircle2, XCircle, Loader2, AlertCircle, Clock, ChevronDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/context/CurrencyProvider";
import { apiFetch } from "@/lib/api";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    pending:    { cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",   label: "Pending" },
    validating: { cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",         label: "Validating" },
    approved:   { cls: "bg-orange-500/10 text-orange-400 border-orange-500/20",   label: "Approved (In Progress)" },
    rejected:   { cls: "bg-red-500/10 text-red-400 border-red-500/20",            label: "Rejected" },
    completed:  { cls: "bg-green-500/10 text-green-400 border-green-500/20",      label: "Completed" },
    cancelled:  { cls: "bg-secondary text-muted-foreground border-transparent",   label: "Cancelled" },
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
  const [expiryDate, setExpiryDate] = useState<Record<string, string>>({});

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

  const complete = async (id: string) => {
    setActioning(id);
    try {
      await apiFetch(`/api/admin/domain-transfers/${id}/complete`, {
        method: "PUT",
        body: JSON.stringify({
          adminNotes: adminNotes[id] || "",
          expiryDate: expiryDate[id] || null,
        }),
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
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }
  if (error) {
    return <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive"><AlertCircle size={18} /> {error}</div>;
  }

  const pending  = transfers.filter(t => t.status === "pending" || t.status === "validating");
  const approved = transfers.filter(t => t.status === "approved");
  const done     = transfers.filter(t => ["completed", "rejected", "cancelled"].includes(t.status));

  const TransferRow = ({ t, actions }: { t: any; actions: React.ReactNode }) => (
    <div key={t.id}>
      <div
        className="p-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors cursor-pointer"
        onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
      >
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
          <Globe size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">{t.domainName}</span>
            <StatusBadge status={t.status} />
          </div>
          <p className="text-xs text-muted-foreground">{t.firstName} {t.lastName} · {t.email}</p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="font-medium text-foreground">{formatPrice(parseFloat(t.price || "0"))}</div>
          <div className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</div>
        </div>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform shrink-0 ${expandedId === t.id ? "rotate-180" : ""}`} />
      </div>

      {expandedId === t.id && (
        <div className="p-5 bg-secondary/20 border-t border-border space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Domain</span>
              <p className="font-medium text-foreground font-mono">{t.domainName}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">EPP Code</span>
              <p className="font-medium text-foreground font-mono text-sm bg-secondary/60 rounded px-2 py-1 mt-0.5 select-all">{t.epp}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Client</span>
              <p className="font-medium text-foreground">{t.firstName} {t.lastName}</p>
              <p className="text-xs text-muted-foreground">{t.email}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Transfer Fee</span>
              <p className="font-bold text-foreground">{formatPrice(parseFloat(t.price || "0"))}</p>
            </div>
            {t.validationMessage && (
              <div className="col-span-2">
                <span className="text-muted-foreground text-xs">Validation</span>
                <p className="text-sm text-foreground">{t.validationMessage}</p>
              </div>
            )}
            {t.adminNotes && (
              <div className="col-span-2">
                <span className="text-muted-foreground text-xs">Previous Notes</span>
                <p className="text-sm text-foreground">{t.adminNotes}</p>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Admin Notes (sent to client)</label>
            <textarea
              value={adminNotes[t.id] || ""}
              onChange={e => setAdminNotes(n => ({ ...n, [t.id]: e.target.value }))}
              rows={2}
              placeholder="Reason for approval/rejection, or any notes..."
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {actions}
        </div>
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Domain Transfers</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Review and manage incoming domain transfer requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Requests",   value: transfers.length,                                                  color: "text-primary" },
          { label: "Pending Review",   value: pending.length,                                                    color: "text-yellow-400" },
          { label: "In Progress",      value: approved.length,                                                   color: "text-orange-400" },
          { label: "Completed",        value: transfers.filter(t => t.status === "completed").length,            color: "text-green-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <div className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Pending transfers — waiting for admin review */}
      {pending.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <Clock size={16} className="text-yellow-400" />
            <h2 className="font-semibold text-foreground">Pending Review ({pending.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {pending.map((t: any) => (
              <TransferRow key={t.id} t={t} actions={
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => approve(t.id)} disabled={actioning === t.id} className="gap-2 bg-green-600 hover:bg-green-700">
                    {actioning === t.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve & Start Transfer
                  </Button>
                  <Button variant="outline" onClick={() => reject(t.id)} disabled={actioning === t.id} className="gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10">
                    {actioning === t.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject
                  </Button>
                </div>
              } />
            ))}
          </div>
        </div>
      )}

      {/* Approved transfers — in progress, waiting to complete */}
      {approved.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <ArrowRight size={16} className="text-orange-400" />
            <h2 className="font-semibold text-foreground">Transfer In Progress ({approved.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {approved.map((t: any) => (
              <TransferRow key={t.id} t={t} actions={
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Expiry Date (optional — defaults to +1 year)</label>
                    <input
                      type="date"
                      value={expiryDate[t.id] || ""}
                      onChange={e => setExpiryDate(d => ({ ...d, [t.id]: e.target.value }))}
                      className="bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => complete(t.id)} disabled={actioning === t.id} className="gap-2 bg-green-600 hover:bg-green-700">
                      {actioning === t.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Mark Transfer Complete
                    </Button>
                    <Button variant="outline" onClick={() => reject(t.id)} disabled={actioning === t.id} className="gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10">
                      {actioning === t.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject
                    </Button>
                  </div>
                </div>
              } />
            ))}
          </div>
        </div>
      )}

      {/* Completed / rejected transfers */}
      {done.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-semibold text-foreground">History ({done.length})</h2>
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
                {done.map((t: any) => (
                  <tr key={t.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground font-mono">{t.domainName}</td>
                    <td className="px-5 py-3">
                      <div className="text-foreground">{t.firstName} {t.lastName}</div>
                      <div className="text-xs text-muted-foreground">{t.email}</div>
                    </td>
                    <td className="px-5 py-3 text-foreground">{formatPrice(parseFloat(t.price || "0"))}</td>
                    <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(t.updatedAt || t.createdAt).toLocaleDateString()}</td>
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
