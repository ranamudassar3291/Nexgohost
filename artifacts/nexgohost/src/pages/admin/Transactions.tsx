import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CreditCard, Search, TrendingUp, CheckCircle, XCircle, Clock, Loader2,
  DollarSign, ArrowUpRight, RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useCurrency } from "@/context/CurrencyProvider";
import { useQueryClient } from "@tanstack/react-query";

interface Transaction {
  id: string;
  clientId: string;
  clientName: string;
  invoiceId: string | null;
  amount: number;
  method: string;
  status: string;
  transactionRef: string;
  createdAt: string;
}

async function apiFetch(url: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const METHOD_CONFIG: Record<string, { label: string; color: string }> = {
  bank:    { label: "Bank Transfer",   color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  stripe:  { label: "Stripe",          color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  paypal:  { label: "PayPal",          color: "bg-amber-50 text-amber-700 border-amber-200" },
  crypto:  { label: "Crypto",          color: "bg-amber-50 text-amber-700 border-amber-200" },
  manual:  { label: "Manual",          color: "bg-secondary text-muted-foreground border-border" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  completed: { label: "Completed", color: "bg-green-500/10 text-green-400 border-green-500/20",   icon: CheckCircle },
  pending:   { label: "Pending",   color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  failed:    { label: "Failed",    color: "bg-red-50 text-red-600 border-red-200",           icon: XCircle },
  refunded:  { label: "Refunded",  color: "bg-blue-500/10 text-blue-400 border-blue-500/20",        icon: RefreshCw },
};

const FILTER_TABS = ["all", "completed", "pending", "failed", "refunded"];

export default function AdminTransactions() {
  const { formatPrice } = useCurrency();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: transactions = [], isLoading, refetch } = useQuery<Transaction[]>({
    queryKey: ["admin-transactions"],
    queryFn: () => apiFetch("/api/payments/transactions"),
    staleTime: 30000,
  });

  const filtered = transactions.filter(t => {
    const matchSearch =
      t.clientName.toLowerCase().includes(search.toLowerCase()) ||
      t.transactionRef.toLowerCase().includes(search.toLowerCase()) ||
      (t.invoiceId || "").toLowerCase().includes(search.toLowerCase());
    const matchMethod = methodFilter === "all" || t.method === methodFilter;
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchMethod && matchStatus;
  });

  const totalAmount = transactions.filter(t => t.status === "completed").reduce((s, t) => s + t.amount, 0);
  const pendingAmount = transactions.filter(t => t.status === "pending").reduce((s, t) => s + t.amount, 0);
  const uniqueMethods = Array.from(new Set(transactions.map(t => t.method)));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Transactions</h2>
          <p className="text-muted-foreground mt-1">All payment transactions across the platform</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => { queryClient.invalidateQueries({ queryKey: ["admin-transactions"] }); }}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-green-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
            <TrendingUp size={20} className="text-green-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Collected</p>
            <p className="text-xl font-bold text-green-400">{formatPrice(totalAmount)}</p>
            <p className="text-xs text-muted-foreground">{transactions.filter(t => t.status === "completed").length} transactions</p>
          </div>
        </div>
        <div className="bg-card border border-yellow-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
            <Clock size={20} className="text-yellow-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-xl font-bold text-yellow-400">{formatPrice(pendingAmount)}</p>
            <p className="text-xs text-muted-foreground">{transactions.filter(t => t.status === "pending").length} awaiting</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <DollarSign size={20} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">All Transactions</p>
            <p className="text-xl font-bold text-foreground">{transactions.length}</p>
            <p className="text-xs text-muted-foreground">across {uniqueMethods.length} methods</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 bg-card border-border"
            placeholder="Search by client, ref, or invoice..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg border capitalize transition-all ${statusFilter === f ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          value={methodFilter}
          onChange={e => setMethodFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground"
        >
          <option value="all">All Methods</option>
          <option value="bank">Bank Transfer</option>
          <option value="stripe">Stripe</option>
          <option value="paypal">PayPal</option>
          <option value="crypto">Crypto</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {/* Transactions table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ref / Date</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => {
                const methodCfg = METHOD_CONFIG[tx.method] || METHOD_CONFIG.manual;
                const statusCfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                return (
                  <tr key={tx.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-xs font-mono text-primary">{tx.transactionRef}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(tx.createdAt), "MMM d, yyyy · HH:mm")}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">{tx.clientName || "—"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-foreground">{formatPrice(tx.amount)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${methodCfg.color}`}>
                        {methodCfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusCfg.color}`}>
                        <StatusIcon size={11} />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {tx.invoiceId ? (
                        <div className="flex items-center gap-1.5 text-xs text-primary font-mono hover:underline cursor-pointer">
                          <ArrowUpRight size={12} />
                          {tx.invoiceId.slice(0, 12)}…
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <CreditCard size={40} className="mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">No transactions found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
