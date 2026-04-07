import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search, CheckCircle, Plus, FileText, TrendingUp, Clock,
  Trash2, Edit2, Eye, ChevronLeft, ChevronRight, X, Loader2, XCircle, FileDown, Calendar, Wrench,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useCurrency } from "@/context/CurrencyProvider";

const INV_DURATION_OPTIONS = [
  { label: "1 Mo",   months: 1  },
  { label: "3 Mo",   months: 3  },
  { label: "6 Mo",   months: 6  },
  { label: "1 Year", months: 12 },
  { label: "2 Yrs",  months: 24 },
];

function addMonthsFromToday(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function fmtShort(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const statusColors: Record<string, string> = {
  unpaid:          "bg-amber-50 text-amber-700 border-amber-200",
  payment_pending: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  paid:            "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled:       "bg-red-50 text-red-600 border-red-200",
  overdue:         "bg-red-50 text-red-600 border-red-200",
  refunded:        "bg-blue-500/10 text-blue-400 border-blue-500/20",
  collections:     "bg-purple-50 text-purple-700 border-purple-200",
};

const ALL_STATUSES = ["unpaid", "payment_pending", "paid", "cancelled", "overdue", "refunded", "collections"];
const filterTabs = ["all", ...ALL_STATUSES];

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  amount: number;
  tax: number;
  total: number;
  status: string;
  dueDate: string;
  paidDate?: string;
  paymentRef?: string;
  paymentGatewayId?: string;
  paymentNotes?: string;
  invoiceType?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  createdAt: string;
}

interface PagedResponse {
  data: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}


interface EditModal {
  id: string;
  invoiceNumber: string;
  status: string;
  dueDate: string;
  paidDate: string;
  paymentRef: string;
  paymentNotes: string;
  amount: string;
  total: string;
}

interface ViewModal { invoice: Invoice }

export default function AdminInvoices() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [paged, setPaged] = useState<PagedResponse | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [viewModal, setViewModal] = useState<ViewModal | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [recalcFixing, setRecalcFixing] = useState(false);

  const handleRecalcZero = async () => {
    setRecalcFixing(true);
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/admin/invoices/recalculate-zero", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({
        title: `Fixed ${data.fixed} invoice${data.fixed !== 1 ? "s" : ""}`,
        description: `${data.skipped} skipped (no linked service). ${data.total} zero-amount invoices checked.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
    } catch (err: any) {
      toast({ title: "Recalculation failed", description: err.message, variant: "destructive" });
    } finally {
      setRecalcFixing(false);
    }
  };

  const handleDownloadPdf = async (invoiceId: string, invoiceNumber: string) => {
    setDownloadingPdf(true);
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/admin/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Noehost-Invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
    }
  };
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filter !== "all") params.set("status", filter);
      const data: PagedResponse = await apiFetch(`/api/admin/invoices?${params}`);
      setPaged(data);
    } catch (err: any) {
      toast({ title: "Failed to load invoices", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, filter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const invoices = paged?.data ?? [];

  const handleMarkPaid = async (id: string) => {
    setLoadingId(id);
    try {
      await apiFetch(`/api/admin/invoices/${id}/mark-paid`, { method: "POST" });
      toast({ title: "Invoice marked as paid" });
      fetchInvoices();
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setLoadingId(null); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this invoice?")) return;
    setLoadingId(id);
    try {
      await apiFetch(`/api/admin/invoices/${id}/cancel`, { method: "POST" });
      toast({ title: "Invoice cancelled" });
      fetchInvoices();
    } catch (err: any) {
      toast({ title: "Failed to cancel", description: err.message, variant: "destructive" });
    } finally { setLoadingId(null); }
  };

  const handleDelete = async (id: string, invNum: string) => {
    if (!confirm(`Delete invoice ${invNum}? This cannot be undone.`)) return;
    setLoadingId(id);
    try {
      await apiFetch(`/api/admin/invoices/${id}`, { method: "DELETE" });
      toast({ title: "Invoice deleted" });
      fetchInvoices();
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    } finally { setLoadingId(null); }
  };

  const openEdit = (inv: Invoice) => {
    setEditModal({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      dueDate: inv.dueDate ? inv.dueDate.split("T")[0] : "",
      paidDate: inv.paidDate ? inv.paidDate.split("T")[0] : "",
      paymentRef: inv.paymentRef || "",
      paymentNotes: inv.paymentNotes || "",
      amount: String(inv.amount),
      total: String(inv.total),
    });
  };

  const handleEditSave = async () => {
    if (!editModal) return;
    setEditSaving(true);
    try {
      await apiFetch(`/api/admin/invoices/${editModal.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: editModal.status,
          dueDate: editModal.dueDate || null,
          paidDate: editModal.paidDate || null,
          paymentRef: editModal.paymentRef || null,
          paymentNotes: editModal.paymentNotes || null,
          amount: parseFloat(editModal.amount),
          total: parseFloat(editModal.total),
        }),
      });
      toast({ title: "Invoice updated" });
      setEditModal(null);
      fetchInvoices();
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    } finally { setEditSaving(false); }
  };

  const totalRevenue = (paged?.data ?? []).filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const pendingRevenue = (paged?.data ?? []).filter(i => i.status === "unpaid").reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-6">
      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditModal(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-foreground text-lg">Edit Invoice</h3>
                <p className="text-sm text-muted-foreground font-mono">{editModal.invoiceNumber}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                <select value={editModal.status} onChange={e => setEditModal(m => m ? { ...m, status: e.target.value } : m)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due Date — Quick Set</label>
                <div className="flex flex-wrap gap-1.5">
                  {INV_DURATION_OPTIONS.map(opt => {
                    const val = addMonthsFromToday(opt.months);
                    const active = editModal.dueDate === val;
                    return (
                      <button key={opt.months} type="button"
                        onClick={() => setEditModal(m => m ? { ...m, dueDate: val } : m)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${active ? "bg-blue-500/15 border-blue-500/40 text-blue-400" : "border-border text-muted-foreground hover:border-blue-500/30 hover:text-blue-400"}`}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {editModal.dueDate && (
                  <p className="text-xs flex items-center gap-1.5">
                    <Calendar size={11} className="text-blue-400" />
                    <span className="text-blue-400 font-medium">{fmtShort(editModal.dueDate)}</span>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paid Date</label>
                <Input type="date" value={editModal.paidDate} onChange={e => setEditModal(m => m ? { ...m, paidDate: e.target.value } : m)} className="bg-secondary/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount (PKR)</label>
                  <Input type="number" value={editModal.amount} onChange={e => setEditModal(m => m ? { ...m, amount: e.target.value } : m)} className="bg-secondary/60" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total (PKR)</label>
                  <Input type="number" value={editModal.total} onChange={e => setEditModal(m => m ? { ...m, total: e.target.value } : m)} className="bg-secondary/60" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Reference</label>
                <Input value={editModal.paymentRef} onChange={e => setEditModal(m => m ? { ...m, paymentRef: e.target.value } : m)} placeholder="Transaction ID, ref #..." className="bg-secondary/60" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</label>
                <textarea value={editModal.paymentNotes} onChange={e => setEditModal(m => m ? { ...m, paymentNotes: e.target.value } : m)}
                  rows={3} placeholder="Add notes..."
                  className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button onClick={handleEditSave} disabled={editSaving} className="flex-1 bg-primary hover:bg-primary/90">
                {editSaving ? <Loader2 size={15} className="animate-spin mr-2" /> : null}
                {editSaving ? "Saving…" : "Save Changes"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setEditModal(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setViewModal(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-xl w-full mx-4 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <FileText size={18} className="text-primary" />
                  <h3 className="font-bold text-foreground text-lg font-mono">{viewModal.invoice.invoiceNumber}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${statusColors[viewModal.invoice.status] || ""}`}>{viewModal.invoice.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">Created {format(new Date(viewModal.invoice.createdAt), "MMM d, yyyy")}</p>
              </div>
              <button onClick={() => setViewModal(null)} className="text-muted-foreground hover:text-foreground transition-colors mt-1"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              {/* Client + Type row */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-secondary/40 rounded-xl p-3">
                  <p className="text-muted-foreground text-xs mb-1">Client</p>
                  <button onClick={() => { setViewModal(null); setLocation(`/admin/clients/${viewModal.invoice.clientId}`); }}
                    className="font-semibold text-foreground hover:text-primary transition-colors text-left">
                    {viewModal.invoice.clientName || "—"}
                  </button>
                </div>
                <div className="bg-secondary/40 rounded-xl p-3">
                  <p className="text-muted-foreground text-xs mb-1">Type</p>
                  <p className="font-medium text-foreground capitalize">{viewModal.invoice.invoiceType || "hosting"}</p>
                </div>
                <div className="bg-secondary/40 rounded-xl p-3">
                  <p className="text-muted-foreground text-xs mb-1">Due Date</p>
                  <p className="font-medium text-foreground">{viewModal.invoice.dueDate ? format(new Date(viewModal.invoice.dueDate), "MMM d, yyyy") : "—"}</p>
                </div>
                <div className="bg-secondary/40 rounded-xl p-3">
                  <p className="text-muted-foreground text-xs mb-1">Paid Date</p>
                  <p className={`font-medium ${viewModal.invoice.paidDate ? "text-green-400" : "text-muted-foreground"}`}>
                    {viewModal.invoice.paidDate ? format(new Date(viewModal.invoice.paidDate), "MMM d, yyyy") : "Not paid"}
                  </p>
                </div>
              </div>

              {/* Amount summary */}
              <div className="bg-secondary/20 border border-border/50 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatPrice(viewModal.invoice.amount)}</span>
                </div>
                {viewModal.invoice.tax > 0 && (
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="text-foreground">{formatPrice(viewModal.invoice.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t border-border/50 mt-2 pt-2">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary text-lg">{formatPrice(viewModal.invoice.total)}</span>
                </div>
              </div>

              {/* Line items */}
              {viewModal.invoice.items.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Items</p>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/30">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs text-muted-foreground">Description</th>
                          <th className="text-right px-3 py-2 text-xs text-muted-foreground">Qty</th>
                          <th className="text-right px-3 py-2 text-xs text-muted-foreground">Unit Price</th>
                          <th className="text-right px-3 py-2 text-xs text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewModal.invoice.items.map((item, i) => (
                          <tr key={i} className="border-t border-border/40">
                            <td className="px-3 py-2.5 text-foreground font-medium">{item.description}</td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground">{item.quantity ?? 1}</td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground">{formatPrice(Number(item.unitPrice ?? item.amount ?? item.total ?? 0))}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-foreground">{formatPrice(Number(item.total ?? item.amount ?? 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Payment info */}
              {(viewModal.invoice.paymentRef || viewModal.invoice.paymentNotes) && (
                <div className="space-y-2">
                  {viewModal.invoice.paymentRef && (
                    <div className="bg-secondary/40 rounded-xl p-3 text-sm">
                      <p className="text-muted-foreground text-xs mb-1">Payment Reference</p>
                      <p className="font-mono text-foreground">{viewModal.invoice.paymentRef}</p>
                    </div>
                  )}
                  {viewModal.invoice.paymentNotes && (
                    <div className="bg-secondary/40 rounded-xl p-3 text-sm">
                      <p className="text-muted-foreground text-xs mb-1">Notes</p>
                      <p className="text-foreground">{viewModal.invoice.paymentNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-3 flex-wrap">
              <Button className="flex-1 min-w-[120px]" onClick={() => { setViewModal(null); openEdit(viewModal.invoice); }}>
                <Edit2 size={14} className="mr-2" /> Edit Invoice
              </Button>
              <Button
                variant="outline"
                className="flex-1 min-w-[120px] border-primary/30 text-primary hover:bg-primary/5"
                disabled={downloadingPdf}
                onClick={() => handleDownloadPdf(viewModal.invoice.id, viewModal.invoice.invoiceNumber)}
              >
                {downloadingPdf ? <Loader2 size={14} className="animate-spin mr-2" /> : <FileDown size={14} className="mr-2" />}
                {downloadingPdf ? "Generating…" : "Download PDF"}
              </Button>
              <Button variant="outline" onClick={() => setViewModal(null)} className="flex-1 min-w-[80px]">Close</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Invoices</h2>
          <p className="text-muted-foreground mt-1">
            {paged ? `${paged.total.toLocaleString()} total invoices` : "Manage all billing and invoice records"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRecalcZero}
            disabled={recalcFixing}
            className="h-10 rounded-xl border-orange-500/40 text-orange-500 hover:bg-orange-500/10 hover:border-orange-500/60 text-sm"
            title="Re-calculate amounts for any invoices showing 0.00 from the linked service plan price"
          >
            {recalcFixing ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Wrench size={14} className="mr-1.5" />}
            Fix 0.00 Invoices
          </Button>
          <Button onClick={() => setLocation("/admin/invoices/add")} className="bg-primary hover:bg-primary/90 h-10 rounded-xl">
            <Plus size={16} className="mr-2" /> Create Invoice
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-green-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
            <TrendingUp size={20} className="text-green-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Collected (this page)</p>
            <p className="text-2xl font-bold text-green-400">{formatPrice(totalRevenue)}</p>
          </div>
        </div>
        <div className="bg-card border border-yellow-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
            <Clock size={20} className="text-yellow-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending (this page)</p>
            <p className="text-2xl font-bold text-yellow-400">{formatPrice(pendingRevenue)}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <FileText size={20} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Invoices</p>
            <p className="text-2xl font-bold text-foreground">{paged?.total.toLocaleString() ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 bg-card border-border" placeholder="Search by invoice # or client name..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filterTabs.map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1.5 text-xs rounded-lg border capitalize transition-all ${filter === f ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoice #</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due Date</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paid Date</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <Loader2 size={32} className="animate-spin mx-auto text-primary/50" />
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <FileText size={40} className="mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">No invoices found</p>
                  </td>
                </tr>
              ) : invoices.map(inv => (
                <tr key={inv.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <button onClick={() => setViewModal({ invoice: inv })}
                      className="text-sm font-mono text-primary hover:underline">
                      {inv.invoiceNumber}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => setLocation(`/admin/clients/${inv.clientId}`)}
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                      {inv.clientName || "—"}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-foreground">{formatPrice(Number(inv.total))}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${statusColors[inv.status] || "bg-secondary text-secondary-foreground border-border"}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">
                    {inv.dueDate ? format(new Date(inv.dueDate), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">
                    {inv.paidDate ? format(new Date(inv.paidDate), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">
                    {format(new Date(inv.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setViewModal({ invoice: inv })} title="View"
                        className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => openEdit(inv)} title="Edit"
                        className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-colors text-muted-foreground hover:text-blue-400">
                        <Edit2 size={14} />
                      </button>
                      {inv.status === "unpaid" && (
                        <button onClick={() => handleMarkPaid(inv.id)} title="Mark Paid" disabled={loadingId === inv.id}
                          className="p-1.5 rounded-lg hover:bg-green-500/10 transition-colors text-muted-foreground hover:text-green-400">
                          {loadingId === inv.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        </button>
                      )}
                      {(inv.status === "unpaid" || inv.status === "overdue") && (
                        <button onClick={() => handleCancel(inv.id)} title="Cancel" disabled={loadingId === inv.id}
                          className="p-1.5 rounded-lg hover:bg-orange-500/10 transition-colors text-muted-foreground hover:text-orange-400">
                          <XCircle size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(inv.id, inv.invoiceNumber)} title="Delete" disabled={loadingId === inv.id}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {paged && paged.totalPages > 1 && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {paged.page} of {paged.totalPages} · {paged.total.toLocaleString()} invoices
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} className="mr-1" /> Prev
              </Button>
              {Array.from({ length: Math.min(5, paged.totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, paged.totalPages - 4));
                const p = start + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                    {p}
                  </button>
                );
              })}
              <Button variant="outline" size="sm" disabled={page >= paged.totalPages} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
