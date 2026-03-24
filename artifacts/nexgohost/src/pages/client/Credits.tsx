import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, ArrowDownLeft, ArrowUpRight, Plus, History, ShoppingBag, Gift,
  AlertCircle, Loader2, PlusCircle, FileText, Check, Info,
} from "lucide-react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyProvider";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const P = "#701AFE";

interface CreditTransaction {
  id: string;
  userId: string;
  amount: string;
  type: "affiliate_payout" | "invoice_payment" | "admin_add" | "admin_deduct" | "refund";
  description: string | null;
  invoiceId: string | null;
  withdrawalId: string | null;
  createdAt: string;
}

const TX_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; direction: "in" | "out" }> = {
  affiliate_payout: { label: "Affiliate Payout",   icon: Gift,          color: "text-emerald-600", bg: "bg-emerald-50",  direction: "in"  },
  invoice_payment:  { label: "Invoice Payment",    icon: ShoppingBag,   color: "text-orange-500",  bg: "bg-orange-50",   direction: "out" },
  admin_add:        { label: "Bonus Credit",       icon: Plus,          color: "text-violet-600",  bg: "bg-violet-50",   direction: "in"  },
  admin_deduct:     { label: "Credits Deducted",   icon: ArrowUpRight,  color: "text-red-500",     bg: "bg-red-50",      direction: "out" },
  refund:           { label: "Refund",             icon: ArrowDownLeft, color: "text-emerald-600", bg: "bg-emerald-50",  direction: "in"  },
  deposit:          { label: "Wallet Deposit",     icon: ArrowDownLeft, color: "text-emerald-600", bg: "bg-emerald-50",  direction: "in"  },
};

const PRESET_AMOUNTS = [500, 1000, 2500, 5000];

export default function Credits() {
  const { formatPrice } = useCurrency();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState("");

  const { data, isLoading } = useQuery<{ creditBalance: string; transactions: CreditTransaction[] }>({
    queryKey: ["my-credits"],
    queryFn: () => apiFetch("/api/my/credits"),
  });

  const balance = parseFloat(data?.creditBalance ?? "0");
  const txs = data?.transactions ?? [];

  const totalIn  = txs.filter(t => TX_CONFIG[t.type]?.direction === "in").reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOut = txs.filter(t => TX_CONFIG[t.type]?.direction === "out").reduce((s, t) => s + parseFloat(t.amount), 0);

  const depositMutation = useMutation({
    mutationFn: (amt: number) => apiFetch("/api/my/credits/generate-invoice", {
      method: "POST",
      body: JSON.stringify({ amount: amt }),
    }),
    onSuccess: (invoice: any) => {
      qc.invalidateQueries({ queryKey: ["my-credits"] });
      toast({ title: "Invoice created!", description: `Invoice ${invoice.invoiceNumber} is ready. Pay it to top up your wallet.` });
      setLocation(`/client/invoices/${invoice.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleDeposit = () => {
    const amt = parseFloat(amount);
    setAmountError("");
    if (!amount || isNaN(amt)) { setAmountError("Please enter an amount."); return; }
    if (amt < 270) { setAmountError("Minimum deposit is Rs. 270."); return; }
    if (amt > 100000) { setAmountError("Maximum deposit is Rs. 1,00,000."); return; }
    depositMutation.mutate(amt);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Wallet</h1>
        <p className="text-muted-foreground mt-1 text-sm">Add funds to your account and use them to pay for services instantly.</p>
      </div>

      {/* Balance + stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Main balance card */}
        <div className="sm:col-span-1 relative rounded-2xl p-5 overflow-hidden text-white"
          style={{ background: `linear-gradient(135deg, ${P}, #9f5eff)` }}>
          <div className="absolute top-0 right-0 w-36 h-36 rounded-full opacity-10 blur-2xl" style={{ background: "#fff", transform: "translate(30%,-30%)" }}/>
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={16} className="opacity-80"/>
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">Available Balance</span>
          </div>
          {isLoading
            ? <div className="h-10 w-32 bg-white/20 rounded-xl animate-pulse"/>
            : <p className="text-[2rem] font-extrabold leading-none">{formatPrice(balance)}</p>
          }
          <p className="text-[11px] opacity-70 mt-2">Ready to use on any service</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownLeft size={16} className="text-emerald-500"/>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Added</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatPrice(totalIn)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Deposits, payouts &amp; additions</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpRight size={16} className="text-orange-400"/>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Spent</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatPrice(totalOut)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Used to pay invoices &amp; orders</p>
        </div>
      </div>

      {/* Add Funds */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${P}15` }}>
            <PlusCircle size={18} style={{ color: P }}/>
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Add Funds</h2>
            <p className="text-[12px] text-muted-foreground">Generate an invoice and pay via JazzCash or Bank Transfer.</p>
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESET_AMOUNTS.map(a => (
            <button key={a} onClick={() => { setAmount(String(a)); setAmountError(""); }}
              className="px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all"
              style={amount === String(a)
                ? { borderColor: P, background: `${P}10`, color: P }
                : { borderColor: "var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }
              }>
              {formatPrice(a)}
            </button>
          ))}
        </div>

        {/* Amount input */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-muted-foreground">Rs.</span>
            <input
              type="number"
              value={amount}
              onChange={e => { setAmount(e.target.value); setAmountError(""); }}
              placeholder="Enter amount (min Rs. 270)"
              min={270}
              max={100000}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-input bg-background text-[14px] font-semibold focus:outline-none transition-all"
              onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}20`; }}
              onBlur={e  => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.boxShadow = ""; }}
            />
          </div>
          <button
            onClick={handleDeposit}
            disabled={depositMutation.isPending || !amount}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[13px] font-bold text-white disabled:opacity-60 transition-all"
            style={{ background: P, boxShadow: `0 4px 16px ${P}30` }}>
            {depositMutation.isPending
              ? <><Loader2 size={14} className="animate-spin"/> Generating…</>
              : <><FileText size={14}/> Generate Invoice</>
            }
          </button>
        </div>

        {amountError && (
          <div className="flex items-center gap-2 mt-3 text-[12.5px] text-red-500">
            <AlertCircle size={13}/> {amountError}
          </div>
        )}

        <AnimatePresence>
          {depositMutation.isSuccess && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[12.5px] text-emerald-700 font-medium">
              <Check size={14}/> Invoice generated! Redirecting to payment…
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-start gap-2 mt-4 p-3 bg-muted/40 rounded-xl text-[11.5px] text-muted-foreground">
          <Info size={13} className="shrink-0 mt-0.5"/>
          <span>Once you pay the invoice, our team will verify and credit your wallet within a few minutes. Balance is added automatically when the invoice is marked paid.</span>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-2xl p-5" style={{ background: `${P}08`, border: `1px solid ${P}20` }}>
        <h3 className="text-sm font-bold text-foreground mb-3">How it works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { step: "1", title: "Add Funds", desc: "Enter an amount and generate an invoice." },
            { step: "2", title: "Pay Invoice", desc: "Pay via JazzCash, EasyPaisa, or Bank Transfer." },
            { step: "3", title: "Use Balance", desc: "Your wallet is credited automatically. Use it at checkout." },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0 mt-0.5"
                style={{ background: P }}>
                {s.step}
              </div>
              <div>
                <p className="text-[12px] font-bold text-foreground">{s.title}</p>
                <p className="text-[11px] text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <History size={16} className="text-muted-foreground"/>
          <h2 className="text-base font-semibold text-foreground">Transaction History</h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 size={28} className="animate-spin text-primary"/></div>
        ) : txs.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
            <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40"/>
            <p className="text-foreground font-medium">No transactions yet</p>
            <p className="text-muted-foreground text-sm mt-1">Your wallet history will appear here.</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_2fr_auto_auto] gap-4 px-4 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>Date</span>
              <span>Description</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Type</span>
            </div>
            <div className="space-y-2">
              {txs.map(tx => {
                const cfg = TX_CONFIG[tx.type] ?? { label: tx.type, icon: Wallet, color: "text-muted-foreground", bg: "bg-muted", direction: "in" as const };
                const Icon = cfg.icon;
                const isIn = cfg.direction === "in";
                return (
                  <div key={tx.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <Icon size={15} className={cfg.color}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground">{cfg.label}</p>
                      {tx.description && <p className="text-[11px] text-muted-foreground truncate">{tx.description}</p>}
                      <p className="text-[11px] text-muted-foreground">{format(new Date(tx.createdAt), "MMM d, yyyy · h:mm a")}</p>
                    </div>
                    <div className={`text-[14px] font-extrabold shrink-0 ${isIn ? "text-emerald-600" : "text-orange-500"}`}>
                      {isIn ? "+" : "−"}{formatPrice(parseFloat(tx.amount))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
