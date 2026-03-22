import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Wallet, ArrowDownLeft, ArrowUpRight, Plus, History, ShoppingBag, Gift } from "lucide-react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyProvider";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

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

const TX_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; direction: "in" | "out" }> = {
  affiliate_payout: { label: "Affiliate Payout",   icon: Gift,         color: "text-emerald-500",   direction: "in"  },
  invoice_payment:  { label: "Invoice Payment",    icon: ShoppingBag,  color: "text-orange-400",    direction: "out" },
  admin_add:        { label: "Credits Added",      icon: Plus,         color: "text-blue-400",      direction: "in"  },
  admin_deduct:     { label: "Credits Deducted",   icon: ArrowUpRight, color: "text-red-400",       direction: "out" },
  refund:           { label: "Refund",             icon: ArrowDownLeft, color: "text-emerald-500",  direction: "in"  },
};

export default function Credits() {
  const { formatPrice } = useCurrency();
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<{ creditBalance: string; transactions: CreditTransaction[] }>({
    queryKey: ["my-credits"],
    queryFn: () => apiFetch("/api/my/credits"),
  });

  const balance = parseFloat(data?.creditBalance ?? "0");
  const txs = data?.transactions ?? [];

  const totalIn  = txs.filter(t => TX_CONFIG[t.type]?.direction === "in").reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOut = txs.filter(t => TX_CONFIG[t.type]?.direction === "out").reduce((s, t) => s + parseFloat(t.amount), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account Credits</h1>
        <p className="text-muted-foreground mt-1">Your credit balance can be used to pay invoices instantly — no gateway required.</p>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={18} className="text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Available Balance</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{formatPrice(balance)}</p>
          <p className="text-xs text-muted-foreground mt-1">Ready to use on invoices</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownLeft size={18} className="text-blue-400" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Earned</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatPrice(totalIn)}</p>
          <p className="text-xs text-muted-foreground mt-1">Affiliate payouts &amp; additions</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpRight size={18} className="text-orange-400" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Spent</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatPrice(totalOut)}</p>
          <p className="text-xs text-muted-foreground mt-1">Used to pay invoices</p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2">How credits work</h3>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-2"><span className="text-primary mt-0.5">→</span> Earn credits when your affiliate commission withdrawals are approved and paid out.</li>
          <li className="flex items-start gap-2"><span className="text-primary mt-0.5">→</span> Credits are added instantly to your balance when admin marks your withdrawal as paid.</li>
          <li className="flex items-start gap-2"><span className="text-primary mt-0.5">→</span> Use credits on any unpaid invoice — the amount is deducted instantly and the invoice is marked paid.</li>
          <li className="flex items-start gap-2"><span className="text-primary mt-0.5">→</span> Credits never expire.</li>
        </ul>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setLocation("/client/invoices")} className="text-xs">
            Pay an Invoice
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLocation("/client/affiliate")} className="text-xs">
            Earn More Credits
          </Button>
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <History size={16} className="text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Transaction History</h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : txs.length === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-2xl p-12 text-center">
            <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-foreground font-medium">No transactions yet</p>
            <p className="text-muted-foreground text-sm mt-1">Credits will appear here after your first affiliate payout.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {txs.map(tx => {
              const cfg = TX_CONFIG[tx.type] ?? { label: tx.type, icon: Wallet, color: "text-muted-foreground", direction: "in" as const };
              const Icon = cfg.icon;
              const isIn = cfg.direction === "in";
              return (
                <div key={tx.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isIn ? "bg-emerald-500/10" : "bg-orange-500/10"}`}>
                    <Icon size={16} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{cfg.label}</p>
                    {tx.description && <p className="text-xs text-muted-foreground truncate">{tx.description}</p>}
                    <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
                  </div>
                  <div className={`text-sm font-bold shrink-0 ${isIn ? "text-emerald-500" : "text-orange-400"}`}>
                    {isIn ? "+" : "-"}{formatPrice(parseFloat(tx.amount))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
