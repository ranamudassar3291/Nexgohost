import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, CheckCircle, AlertTriangle, RefreshCw, ChevronDown,
  DollarSign, TrendingUp, Wallet, Activity, X, Zap,
  CheckSquare, Square, Server, Eye, AlertCircle, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const BRAND = "#701AFE";
const BRAND_GRADIENT = "linear-gradient(135deg, #701AFE 0%, #9B51E0 60%, #C084FC 100%)";

async function apiFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

interface PendingItem {
  orderId: string;
  domainId: string | null;
  fullDomain: string;
  name: string;
  tld: string;
  domainStatus: string;
  amount: number;
  billingCycle: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  invoiceId: string | null;
  orderCreatedAt: string;
}

interface Registrar {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface PreparePriceData {
  fullDomain: string;
  tld: string;
  clientPaidPkr: number;
  registrarId: string;
  registrarName: string;
  registrarType: string;
  liveCostUsd: number;
  liveCostPkr: number;
  usdToPkr: number;
  profitPkr: number;
  lossRisk: boolean;
  lossThresholdUsd: number;
  priceError?: string;
  buffer: number;
}

// ── Loss Risk Badge ───────────────────────────────────────────────────────────
function LossRiskBadge({ risk }: { risk: boolean }) {
  if (risk) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-500 border border-red-500/25">
      <AlertTriangle size={10} /> LOSS RISK
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/25">
      <CheckCircle size={10} /> Profitable
    </span>
  );
}

// ── Activation Modal ──────────────────────────────────────────────────────────
function ActivationModal({
  items, registrars, onClose, onDone,
}: {
  items: PendingItem[];
  registrars: Registrar[];
  onClose: () => void;
  onDone: () => void;
}) {
  const isBulk = items.length > 1;
  const item = items[0];
  const { toast } = useToast();

  const [registrarId, setRegistrarId]   = useState("");
  const [priceData, setPriceData]       = useState<PreparePriceData | null>(null);
  const [loading, setLoading]           = useState(false);
  const [confirming, setConfirming]     = useState(false);
  const [done, setDone]                 = useState(false);
  const [results, setResults]           = useState<any>(null);
  const [step, setStep]                 = useState<"select" | "review" | "done">("select");

  const activeRegs = registrars.filter(r => r.isActive);

  const handleFetchPrice = async () => {
    if (!registrarId) { toast({ title: "Select a registrar", variant: "destructive" }); return; }
    setLoading(true);
    setPriceData(null);
    try {
      const data = await apiFetch("/api/admin/domains/prepare-activation", {
        method: "POST",
        body: JSON.stringify({ orderId: item.orderId, registrarId }),
      });
      setPriceData(data);
      setStep("review");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (isBulk) {
      setConfirming(true);
      try {
        const data = await apiFetch("/api/admin/domains/bulk-confirm-activation", {
          method: "POST",
          body: JSON.stringify({ orderIds: items.map(i => i.orderId), registrarId: registrarId || undefined }),
        });
        setResults(data);
        setStep("done");
        setDone(true);
      } catch (err: any) {
        toast({ title: "Activation failed", description: err.message, variant: "destructive" });
      } finally { setConfirming(false); }
    } else {
      setConfirming(true);
      try {
        const data = await apiFetch("/api/admin/domains/confirm-activation", {
          method: "POST",
          body: JSON.stringify({ orderId: item.orderId, registrarId: registrarId || undefined }),
        });
        setResults(data);
        setStep("done");
        setDone(true);
        toast({ title: "Domain Activated!", description: `${data.domain?.name}${data.domain?.tld} is now live.` });
      } catch (err: any) {
        toast({ title: "Activation failed", description: err.message, variant: "destructive" });
      } finally { setConfirming(false); }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border"
          style={{ background: "linear-gradient(135deg, rgba(112,26,254,0.06) 0%, transparent 100%)" }}>
          <div>
            <h2 className="font-bold text-foreground text-base">
              {isBulk ? `Activate ${items.length} Domains` : `Activate ${item.fullDomain}`}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isBulk
                ? `Bulk activation via same registrar`
                : `Client: ${item.clientName} · Paid: Rs. ${item.amount.toLocaleString()}`
              }
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">

          {step === "done" && results && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex flex-col items-center text-center py-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: BRAND_GRADIENT }}>
                  <CheckCircle size={28} className="text-white" />
                </div>
                {isBulk ? (
                  <>
                    <h3 className="font-bold text-lg text-foreground mb-1">Bulk Activation Complete</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {results.succeeded?.length} succeeded · {results.failed?.length ?? 0} failed
                    </p>
                    {results.failed?.length > 0 && (
                      <div className="w-full space-y-1 mb-4">
                        {results.failed.map((f: any, i: number) => (
                          <div key={i} className="text-xs text-red-500 bg-red-500/5 border border-red-500/20 rounded-lg p-2 text-left">
                            Order {f.orderId?.slice(-6)}: {f.error}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="font-bold text-lg text-foreground mb-1">
                      {results.domain?.name}{results.domain?.tld} is Live!
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Registered via {results.registrar} · Welcome email sent
                    </p>
                    {results.profitPkr > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-semibold">
                        <TrendingUp size={14} /> Net Profit: Rs. {Number(results.profitPkr).toLocaleString()}
                      </div>
                    )}
                  </>
                )}
              </div>
              <Button onClick={() => { onDone(); onClose(); }} className="w-full rounded-xl"
                style={{ background: BRAND_GRADIENT }} >
                Done
              </Button>
            </motion.div>
          )}

          {step !== "done" && (
            <>
              {/* Registrar selector */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                  Select Registrar
                </label>
                <Select value={registrarId} onValueChange={v => { setRegistrarId(v); setStep("select"); setPriceData(null); }}>
                  <SelectTrigger className="rounded-xl border-border">
                    <SelectValue placeholder="Choose a registrar…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Manual (no API call)</SelectItem>
                    {activeRegs.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} <span className="text-muted-foreground ml-1 text-[10px]">({r.type})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bulk domain list */}
              {isBulk && (
                <div className="rounded-xl border border-border bg-muted/20 p-3 max-h-32 overflow-y-auto">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">Domains to activate</p>
                  <div className="space-y-1">
                    {items.map(it => (
                      <div key={it.orderId} className="flex items-center justify-between text-xs">
                        <span className="font-mono font-medium text-foreground">{it.fullDomain}</span>
                        <span className="text-muted-foreground">Rs. {it.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fetch price (single domain only) */}
              {!isBulk && (
                <Button onClick={handleFetchPrice} disabled={loading || !registrarId}
                  variant="outline" className="w-full rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary/5">
                  {loading
                    ? <><RefreshCw size={13} className="animate-spin" /> Fetching live cost…</>
                    : <><Activity size={13} /> Check Live Cost & Margin</>
                  }
                </Button>
              )}

              {/* Price breakdown */}
              {priceData && step === "review" && !isBulk && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl border p-4 space-y-3 ${priceData.lossRisk
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-emerald-500/30 bg-emerald-500/5"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">Price Breakdown</span>
                    <LossRiskBadge risk={priceData.lossRisk} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Wallet size={12} /> Client Paid
                      </span>
                      <span className="font-semibold text-foreground">Rs. {priceData.clientPaidPkr.toLocaleString()}</span>
                    </div>
                    {priceData.registrarType !== "none" && priceData.liveCostUsd > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <DollarSign size={12} /> Live API Cost
                        </span>
                        <span className={`font-bold ${priceData.lossRisk ? "text-red-500" : "text-foreground"}`}>
                          ${priceData.liveCostUsd.toFixed(2)}
                          <span className="text-muted-foreground font-normal text-xs ml-1">
                            (Rs. {priceData.liveCostPkr.toLocaleString()})
                          </span>
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm border-t border-border/50 pt-2">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp size={12} /> Est. Profit
                      </span>
                      <span className={`font-bold text-base ${priceData.profitPkr >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        Rs. {priceData.profitPkr.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {priceData.usdToPkr > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Rate: Rs.{priceData.usdToPkr}/USD (incl. Rs.{priceData.buffer} buffer)
                      · Threshold: ${priceData.lossThresholdUsd}
                    </p>
                  )}
                  {priceData.lossRisk && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600">
                      <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                      Live cost exceeds your loss-prevention threshold. Activating will lock in a loss.
                    </div>
                  )}
                  {priceData.priceError && (
                    <div className="text-xs text-amber-500 flex items-center gap-1">
                      <AlertCircle size={11} /> {priceData.priceError}
                    </div>
                  )}
                </motion.div>
              )}

              {/* CTA */}
              <div className="flex gap-2.5 pt-1">
                <Button onClick={onClose} variant="outline" className="rounded-xl flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={confirming || !registrarId || (!isBulk && step !== "review")}
                  className="rounded-xl flex-1 gap-2 text-white"
                  style={{ background: BRAND_GRADIENT }}
                >
                  {confirming
                    ? <><RefreshCw size={13} className="animate-spin" /> Registering…</>
                    : <><Zap size={13} /> Confirm & Register</>
                  }
                </Button>
              </div>

              {isBulk && (
                <p className="text-[10px] text-muted-foreground text-center -mt-2">
                  Bulk activation uses the selected registrar for all domains. Live prices are checked individually per domain.
                </p>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Domain Row ────────────────────────────────────────────────────────────────
function DomainRow({
  item, selected, onToggle, onActivate,
}: {
  item: PendingItem;
  selected: boolean;
  onToggle: () => void;
  onActivate: (item: PendingItem) => void;
}) {
  const hoursOld = Math.round((Date.now() - new Date(item.orderCreatedAt).getTime()) / 3_600_000);
  const isUrgent = hoursOld >= 12;

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border-b border-border/50 transition-colors ${
        selected ? "bg-primary/5" : "hover:bg-muted/30"
      }`}
    >
      {/* Checkbox */}
      <td className="w-10 px-3 py-3">
        <button onClick={onToggle} className="text-muted-foreground hover:text-primary transition-colors">
          {selected ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
        </button>
      </td>

      {/* Domain */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Globe size={14} style={{ color: BRAND }} />
          </div>
          <div>
            <p className="font-mono font-bold text-foreground text-sm">{item.fullDomain}</p>
            <p className="text-[11px] text-muted-foreground">{item.billingCycle}</p>
          </div>
        </div>
      </td>

      {/* Client */}
      <td className="px-3 py-3">
        <p className="text-sm font-medium text-foreground">{item.clientName || "—"}</p>
        <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{item.clientEmail}</p>
      </td>

      {/* Amount */}
      <td className="px-3 py-3 text-right">
        <p className="font-bold text-foreground text-sm">Rs. {item.amount.toLocaleString()}</p>
        <p className="text-[11px] text-emerald-600">Paid</p>
      </td>

      {/* Age */}
      <td className="px-3 py-3 text-center">
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
          isUrgent
            ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
            : "bg-muted text-muted-foreground border border-border"
        }`}>
          {hoursOld < 1 ? "<1h" : hoursOld < 24 ? `${hoursOld}h` : `${Math.round(hoursOld / 24)}d`}
        </span>
      </td>

      {/* Action */}
      <td className="px-3 py-3 text-right">
        <Button size="sm" onClick={() => onActivate(item)}
          className="h-7 rounded-lg text-xs gap-1.5 text-white"
          style={{ background: BRAND_GRADIENT }}>
          <Zap size={11} /> Activate
        </Button>
      </td>
    </motion.tr>
  );
}

// ── Activation Profit Log ─────────────────────────────────────────────────────
function ProfitLog() {
  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["domain-activation-logs"],
    queryFn: () => apiFetch("/api/admin/domains/activation-logs"),
    staleTime: 30_000,
  });

  const totalProfit = logs.reduce((sum, l) => sum + Number(l.profitPkr ?? 0), 0);
  const totalCost = logs.reduce((sum, l) => sum + Number(l.costPkr ?? 0), 0);

  if (isLoading) return (
    <div className="flex items-center justify-center py-8">
      <RefreshCw size={18} className="animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] text-muted-foreground mb-1">Total Activations</p>
          <p className="text-2xl font-black text-foreground">{logs.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-[11px] text-muted-foreground mb-1">Total Profit</p>
          <p className="text-2xl font-black text-emerald-600">Rs. {totalProfit.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] text-muted-foreground mb-1">Total API Cost</p>
          <p className="text-2xl font-black text-foreground">Rs. {totalCost.toLocaleString()}</p>
        </div>
      </div>

      {/* Log table */}
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Activity size={28} className="text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No activation logs yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-[10px] text-muted-foreground">
                <th className="text-left px-3 py-2 font-semibold">Domain</th>
                <th className="text-left px-3 py-2 font-semibold">Registrar</th>
                <th className="text-right px-3 py-2 font-semibold">Cost (USD)</th>
                <th className="text-right px-3 py-2 font-semibold">Cost (PKR)</th>
                <th className="text-right px-3 py-2 font-semibold">Profit</th>
                <th className="text-right px-3 py-2 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id} className={`border-b border-border/40 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                  <td className="px-3 py-2 font-mono font-medium text-foreground">{log.domainFqdn}</td>
                  <td className="px-3 py-2 text-muted-foreground">{log.registrarName}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {log.costUsd ? `$${Number(log.costUsd).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {log.costPkr ? `Rs. ${Number(log.costPkr).toLocaleString()}` : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${Number(log.profitPkr) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    Rs. {Number(log.profitPkr ?? 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {new Date(log.activatedAt).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PendingActivations() {
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [modalItems, setModalItems]       = useState<PendingItem[] | null>(null);
  const [activeTab, setActiveTab]         = useState<"pending" | "history">("pending");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: pendingData, isLoading: loadingPending, refetch } = useQuery<{ items: PendingItem[]; count: number }>({
    queryKey: ["pending-activations"],
    queryFn: () => apiFetch("/api/admin/domains/pending-activation"),
    refetchInterval: 60_000,
  });

  const { data: registrars = [] } = useQuery<Registrar[]>({
    queryKey: ["admin-domain-registrars"],
    queryFn: () => apiFetch("/api/admin/domain-registrars"),
  });

  const items = pendingData?.items ?? [];

  const toggleSelect = useCallback((orderId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(i => i.orderId)));
  };

  const handleActivateSingle = (item: PendingItem) => {
    setModalItems([item]);
  };

  const handleActivateSelected = () => {
    const selectedItems = items.filter(i => selected.has(i.orderId));
    if (!selectedItems.length) { toast({ title: "Select at least one domain" }); return; }
    setModalItems(selectedItems);
  };

  const handleDone = () => {
    setSelected(new Set());
    setModalItems(null);
    refetch();
    queryClient.invalidateQueries({ queryKey: ["domain-activation-logs"] });
  };

  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Pending Activations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Paid domain orders waiting for registrar activation with live price verification
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="rounded-xl gap-2">
            <RefreshCw size={13} /> Refresh
          </Button>
          {selected.size > 0 && (
            <Button onClick={handleActivateSelected}
              className="rounded-xl gap-2 text-white"
              style={{ background: BRAND_GRADIENT }}>
              <Zap size={13} /> Activate {selected.size} Selected
            </Button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border w-fit">
        {(["pending", "history"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "pending" ? (
              <span className="flex items-center gap-1.5">
                <Globe size={13} />
                Pending
                {items.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-bold"
                    style={{ background: BRAND_GRADIENT, color: "white" }}>
                    {items.length}
                  </span>
                )}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Activity size={13} /> Profit Log
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "pending" ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {loadingPending ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle size={28} style={{ color: BRAND }} />
              </div>
              <h3 className="font-semibold text-foreground mb-1">All Caught Up!</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                No paid domain orders are waiting for activation. New paid orders will appear here automatically.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-[11px] text-muted-foreground">
                  <th className="w-10 px-3 py-3">
                    <button onClick={toggleAll} className="text-muted-foreground hover:text-primary transition-colors">
                      {allSelected ? <CheckSquare size={15} className="text-primary" /> : <Square size={15} />}
                    </button>
                  </th>
                  <th className="text-left px-3 py-3 font-semibold uppercase tracking-wide">Domain</th>
                  <th className="text-left px-3 py-3 font-semibold uppercase tracking-wide">Client</th>
                  <th className="text-right px-3 py-3 font-semibold uppercase tracking-wide">Amount</th>
                  <th className="text-center px-3 py-3 font-semibold uppercase tracking-wide">Age</th>
                  <th className="text-right px-3 py-3 font-semibold uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {items.map(item => (
                    <DomainRow
                      key={item.orderId}
                      item={item}
                      selected={selected.has(item.orderId)}
                      onToggle={() => toggleSelect(item.orderId)}
                      onActivate={handleActivateSingle}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <ProfitLog />
      )}

      {/* Activation modal */}
      <AnimatePresence>
        {modalItems && (
          <ActivationModal
            items={modalItems}
            registrars={registrars}
            onClose={() => setModalItems(null)}
            onDone={handleDone}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
