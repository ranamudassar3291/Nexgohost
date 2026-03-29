import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, CheckCircle2, XCircle, Loader2, AlertCircle, Clock,
  ChevronDown, ArrowRight, Plus, Search, X, User, Key, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/context/CurrencyProvider";
import { apiFetch } from "@/lib/api";

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    pending:    { cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",   label: "Pending" },
    validating: { cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",         label: "Validating" },
    approved:   { cls: "bg-orange-500/10 text-orange-400 border-orange-500/20",   label: "In Progress" },
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

// ── Client Search Dropdown ────────────────────────────────────────────────────
function ClientSearchDropdown({ onSelect }: { onSelect: (u: any) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    apiFetch(`/api/admin/domain-transfers/users/search?q=${encodeURIComponent(q)}`)
      .then(d => setResults(d.users || []))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
  }, [query, search]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const pick = (u: any) => {
    setSelected(u);
    setQuery(`${u.firstName} ${u.lastName} — ${u.email}`);
    setOpen(false);
    onSelect(u);
  };

  const clear = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    onSelect(null);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); setSelected(null); }}
          placeholder="Search client by name or email…"
          className="w-full bg-background border border-border rounded-xl pl-9 pr-8 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {query && (
          <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={13} />
          </button>
        )}
      </div>
      {open && query.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {searching ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 size={13} className="animate-spin" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle size={13} /> User Not Found
            </div>
          ) : (
            results.map(u => (
              <button
                key={u.id}
                onMouseDown={() => pick(u)}
                className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-secondary/40 text-left transition-colors"
              >
                <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <User size={12} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Transfer Modal ────────────────────────────────────────────────────────
function AddTransferModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [domainName, setDomainName] = useState("");
  const [epp, setEpp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!selectedClient) { setError("Please select a client."); return; }
    if (!domainName.trim()) { setError("Please enter a domain name."); return; }
    if (!epp.trim()) { setError("Please enter the EPP/Auth code."); return; }

    setSubmitting(true);
    try {
      await apiFetch("/api/admin/domain-transfers", {
        method: "POST",
        body: JSON.stringify({ clientId: selectedClient.id, domainName: domainName.trim().toLowerCase(), epp: epp.trim() }),
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to create transfer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
              <Globe size={15} className="text-primary" />
            </div>
            <h2 className="font-semibold text-foreground">Add New Transfer</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Client *</label>
            <ClientSearchDropdown onSelect={setSelectedClient} />
            {selectedClient && (
              <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                <CheckCircle2 size={11} /> {selectedClient.firstName} {selectedClient.lastName} selected
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Domain Name *</label>
            <div className="relative">
              <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={domainName}
                onChange={e => setDomainName(e.target.value)}
                placeholder="example.com"
                className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">EPP / Auth Code *</label>
            <div className="relative">
              <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={epp}
                onChange={e => setEpp(e.target.value)}
                placeholder="Authorization code from current registrar"
                className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <p className="text-xs text-muted-foreground">EPP validation is bypassed for admin-created transfers.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create Transfer
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Status Change Dropdown ────────────────────────────────────────────────────
function StatusSelect({ transfer, onChanged }: { transfer: any; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showExpiry, setShowExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const statuses = [
    { value: "pending",   label: "Pending",     cls: "text-yellow-400" },
    { value: "approved",  label: "In Progress", cls: "text-orange-400" },
    { value: "completed", label: "Completed",   cls: "text-green-400" },
    { value: "rejected",  label: "Rejected",    cls: "text-red-400" },
  ];

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const changeStatus = async (newStatus: string) => {
    if (newStatus === transfer.status) { setOpen(false); return; }
    if (newStatus === "completed") { setShowExpiry(true); setOpen(false); return; }
    setBusy(true);
    try {
      await apiFetch(`/api/admin/domain-transfers/${transfer.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      onChanged();
    } catch (e: any) { alert(e.message || "Failed to update status"); }
    finally { setBusy(false); setOpen(false); }
  };

  const confirmComplete = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/domain-transfers/${transfer.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: "completed", expiryDate: expiryDate || null }),
      });
      setShowExpiry(false);
      onChanged();
    } catch (e: any) { alert(e.message || "Failed to complete transfer"); }
    finally { setBusy(false); }
  };

  return (
    <div ref={ref} className="relative inline-block">
      {showExpiry ? (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={expiryDate}
            onChange={e => setExpiryDate(e.target.value)}
            className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={confirmComplete} disabled={busy} className="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-lg flex items-center gap-1">
            {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Confirm
          </button>
          <button onClick={() => setShowExpiry(false)} className="text-xs text-muted-foreground hover:text-foreground">
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(o => !o)}
          disabled={busy}
          className="flex items-center gap-1.5 group"
        >
          {busy ? <Loader2 size={11} className="animate-spin text-muted-foreground" /> : null}
          <StatusBadge status={transfer.status} />
          <ChevronDown size={11} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}

      {open && (
        <div className="absolute z-30 left-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl w-36 overflow-hidden">
          {statuses.map(s => (
            <button
              key={s.value}
              onClick={() => changeStatus(s.value)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-secondary/50 transition-colors ${s.cls} ${s.value === transfer.status ? "bg-secondary/40 font-medium" : ""}`}
            >
              {s.label} {s.value === transfer.status && "✓"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Expanded Detail Panel ─────────────────────────────────────────────────────
function TransferDetail({
  t, adminNotes, onNotesChange, onApprove, onComplete, onReject, actioning,
}: {
  t: any; adminNotes: string; onNotesChange: (v: string) => void;
  onApprove: () => void; onComplete: (d?: string) => void; onReject: () => void; actioning: boolean;
}) {
  const [expiryDate, setExpiryDate] = useState("");
  const active = actioning;

  return (
    <div className="p-5 bg-secondary/20 border-t border-border space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">Domain</span>
          <p className="font-medium text-foreground font-mono mt-0.5">{t.domainName}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">EPP / Auth Code</span>
          <p className="font-medium text-foreground font-mono text-sm bg-secondary/60 rounded px-2 py-1 mt-0.5 select-all break-all">{t.epp}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Client</span>
          <p className="font-medium text-foreground mt-0.5">{t.firstName} {t.lastName}</p>
          <p className="text-xs text-muted-foreground">{t.email}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Transfer Fee</span>
          <p className="font-bold text-foreground mt-0.5">{Number(t.price || 0).toLocaleString()} PKR</p>
        </div>
        {t.validationMessage && (
          <div className="col-span-2">
            <span className="text-muted-foreground text-xs">Validation Notes</span>
            <p className="text-sm text-foreground mt-0.5">{t.validationMessage}</p>
          </div>
        )}
        {t.adminNotes && (
          <div className="col-span-2">
            <span className="text-muted-foreground text-xs">Previous Admin Notes</span>
            <p className="text-sm text-foreground mt-0.5">{t.adminNotes}</p>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Admin Notes (sent to client)</label>
        <textarea
          value={adminNotes}
          onChange={e => onNotesChange(e.target.value)}
          rows={2}
          placeholder="Reason for approval/rejection, or any notes…"
          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {(t.status === "pending" || t.status === "validating") && (
        <div className="flex gap-2 flex-wrap">
          <Button onClick={onApprove} disabled={active} className="gap-2 bg-green-600 hover:bg-green-700 text-sm h-9">
            {active ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Approve & Start
          </Button>
          <Button variant="outline" onClick={onReject} disabled={active} className="gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10 text-sm h-9">
            {active ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} Reject
          </Button>
        </div>
      )}

      {t.status === "approved" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Expiry Date (optional, defaults +1 year)</label>
              <input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => onComplete(expiryDate || undefined)} disabled={active} className="gap-2 bg-green-600 hover:bg-green-700 text-sm h-9">
              {active ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Mark Complete
            </Button>
            <Button variant="outline" onClick={onReject} disabled={active} className="gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10 text-sm h-9">
              {active ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function DomainTransfers() {
  const { formatPrice } = useCurrency();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
      await load(); setExpandedId(null);
    } catch (e: any) { alert(e.message); }
    finally { setActioning(null); }
  };

  const complete = async (id: string, expiryDate?: string) => {
    setActioning(id);
    try {
      await apiFetch(`/api/admin/domain-transfers/${id}/complete`, {
        method: "PUT",
        body: JSON.stringify({ adminNotes: adminNotes[id] || "", expiryDate: expiryDate || null }),
      });
      await load(); setExpandedId(null);
    } catch (e: any) { alert(e.message); }
    finally { setActioning(null); }
  };

  const reject = async (id: string) => {
    setActioning(id);
    try {
      await apiFetch(`/api/admin/domain-transfers/${id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ adminNotes: adminNotes[id] || "" }),
      });
      await load(); setExpandedId(null);
    } catch (e: any) { alert(e.message); }
    finally { setActioning(null); }
  };

  // Filter by search query
  const filtered = transfers.filter(t => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.domainName?.toLowerCase().includes(q) ||
      t.firstName?.toLowerCase().includes(q) ||
      t.lastName?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.status?.toLowerCase().includes(q)
    );
  });

  const counts = {
    total: transfers.length,
    pending: transfers.filter(t => t.status === "pending" || t.status === "validating").length,
    inProgress: transfers.filter(t => t.status === "approved").length,
    completed: transfers.filter(t => t.status === "completed").length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive">
      <AlertCircle size={18} /> {error}
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {showAddModal && (
          <AddTransferModal onClose={() => setShowAddModal(false)} onSuccess={load} />
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Domain Transfers</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Review, manage, and add domain transfer requests</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={load} className="gap-2 h-9 px-3">
              <RefreshCw size={14} />
            </Button>
            <Button onClick={() => setShowAddModal(true)} className="gap-2 h-9">
              <Plus size={14} /> Add Transfer
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Requests", value: counts.total,      color: "text-primary" },
            { label: "Pending Review", value: counts.pending,    color: "text-yellow-400" },
            { label: "In Progress",    value: counts.inProgress, color: "text-orange-400" },
            { label: "Completed",      value: counts.completed,  color: "text-green-400" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <div className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by domain, client name, email, or status…"
            className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>

        {/* All Transfers Table */}
        {transfers.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-16 text-center">
            <Globe size={40} className="text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium text-foreground mb-1">No Transfer Requests</h3>
            <p className="text-sm text-muted-foreground mb-4">Domain transfer requests will appear here when clients submit them, or you can add one manually.</p>
            <Button onClick={() => setShowAddModal(true)} className="gap-2">
              <Plus size={14} /> Add First Transfer
            </Button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-foreground text-sm">
                All Transfers {searchQuery && `— ${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
              </h2>
              {searchQuery && filtered.length === 0 && (
                <span className="text-xs text-muted-foreground">No matches for "{searchQuery}"</span>
              )}
            </div>

            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[1.5fr_2fr_1fr_1.5fr_1.2fr] gap-4 px-5 py-2.5 bg-secondary/20 border-b border-border text-xs text-muted-foreground font-medium">
              <span>Client</span>
              <span>Domain</span>
              <span>Date</span>
              <span>EPP Code (Admin)</span>
              <span>Status</span>
            </div>

            <div className="divide-y divide-border">
              {filtered.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No transfers match your search.
                </div>
              ) : (
                filtered.map((t: any) => (
                  <div key={t.id}>
                    {/* Row */}
                    <div
                      className="grid grid-cols-1 md:grid-cols-[1.5fr_2fr_1fr_1.5fr_1.2fr] gap-3 md:gap-4 px-5 py-3.5 hover:bg-secondary/20 transition-colors cursor-pointer items-center"
                      onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                    >
                      {/* Client */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                          <User size={12} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{t.firstName} {t.lastName}</p>
                          <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                        </div>
                      </div>

                      {/* Domain */}
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe size={13} className="text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground font-mono truncate">{t.domainName}</span>
                      </div>

                      {/* Date */}
                      <div className="text-xs text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                      </div>

                      {/* EPP Code (admin only) */}
                      <div className="flex items-center gap-1.5 min-w-0" onClick={e => e.stopPropagation()}>
                        <Key size={11} className="text-muted-foreground shrink-0" />
                        <span className="text-xs text-foreground font-mono bg-secondary/50 px-2 py-0.5 rounded truncate select-all max-w-[140px]">
                          {t.epp}
                        </span>
                      </div>

                      {/* Status + Change */}
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <StatusSelect transfer={t} onChanged={load} />
                        <ChevronDown
                          size={13}
                          className={`text-muted-foreground transition-transform shrink-0 ml-auto ${expandedId === t.id ? "rotate-180" : ""}`}
                          onClick={e => { e.stopPropagation(); setExpandedId(expandedId === t.id ? null : t.id); }}
                        />
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    <AnimatePresence>
                      {expandedId === t.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <TransferDetail
                            t={t}
                            adminNotes={adminNotes[t.id] || ""}
                            onNotesChange={v => setAdminNotes(n => ({ ...n, [t.id]: v }))}
                            onApprove={() => approve(t.id)}
                            onComplete={(d) => complete(t.id, d)}
                            onReject={() => reject(t.id)}
                            actioning={actioning === t.id}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}
