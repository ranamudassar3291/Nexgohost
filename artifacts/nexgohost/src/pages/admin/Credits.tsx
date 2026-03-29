import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Wallet, Search, Plus, Minus, RotateCcw, Loader2, Users,
  ArrowDownLeft, ArrowUpRight, User, ChevronRight, X,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyProvider";

const TX_LABELS: Record<string, string> = {
  admin_add: "Bonus Credit",
  admin_deduct: "Credits Deducted",
  refund: "Refund",
  affiliate_payout: "Affiliate Payout",
  invoice_payment: "Invoice Payment",
  deposit: "Wallet Deposit",
};

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  creditBalance: string;
  status: string;
}

interface CreditData {
  creditBalance: string;
  transactions: any[];
}

export default function AdminCredits() {
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [adjustType, setAdjustType] = useState<"admin_add" | "admin_deduct" | "refund">("admin_add");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");

  const { data: clientsData, isLoading: searchLoading, refetch: refetchClients } = useQuery<{ clients: Client[] }>({
    queryKey: ["admin-credits-clients", search],
    queryFn: () => apiFetch(`/api/admin/credits/clients${search ? `?q=${encodeURIComponent(search)}` : ""}`),
    staleTime: 10_000,
  });

  const { data: creditData, isLoading: creditLoading } = useQuery<CreditData>({
    queryKey: ["admin-client-credits-panel", selectedClient?.id],
    queryFn: () => apiFetch(`/api/admin/users/${selectedClient!.id}/credits`),
    enabled: !!selectedClient,
  });

  const adjustMutation = useMutation({
    mutationFn: () => apiFetch(`/api/admin/users/${selectedClient!.id}/credits`, {
      method: "POST",
      body: JSON.stringify({
        amount: parseFloat(adjustAmount),
        type: adjustType,
        description: adjustDesc || undefined,
      }),
    }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["admin-client-credits-panel", selectedClient?.id] });
      qc.invalidateQueries({ queryKey: ["admin-credits-clients"] });
      const newBal = parseFloat(res.creditBalance).toFixed(2);
      toast({ title: "Balance updated", description: `New balance: Rs. ${newBal}` });
      setAdjustAmount("");
      setAdjustDesc("");
      if (selectedClient) {
        setSelectedClient({ ...selectedClient, creditBalance: res.creditBalance });
      }
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const clients = clientsData?.clients ?? [];
  const txs = creditData?.transactions ?? [];

  const handleSearch = (val: string) => {
    setSearch(val);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Credit Management</h2>
        <p className="text-muted-foreground text-sm mt-0.5">Search clients and manage their wallet balances.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Client Search */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-primary" />
              <h3 className="font-semibold text-foreground text-sm">Find Client</h3>
            </div>

            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              )}
            </div>

            {searchLoading ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
            ) : clients.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {search ? "No clients found." : "Enter a name or email to search."}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {clients.map(c => (
                  <motion.button key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    onClick={() => { setSelectedClient(c); setAdjustAmount(""); setAdjustDesc(""); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${selectedClient?.id === c.id ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20 hover:bg-secondary/20"}`}>
                    <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {c.firstName[0]}{c.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.firstName} {c.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">{formatPrice(parseFloat(c.creditBalance ?? "0"))}</p>
                      <p className="text-[10px] text-muted-foreground">balance</p>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Adjustment Panel */}
        <div className="space-y-4">
          {!selectedClient ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center">
              <Wallet size={36} className="text-muted-foreground opacity-30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Select a client to manage their wallet</p>
            </div>
          ) : (
            <>
              {/* Balance card */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white text-sm font-bold">
                      {selectedClient.firstName[0]}{selectedClient.lastName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{selectedClient.firstName} {selectedClient.lastName}</p>
                      <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedClient(null)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <X size={14} />
                  </button>
                </div>
                <div className="bg-primary rounded-xl p-4 text-white">
                  <p className="text-xs opacity-70 font-medium uppercase tracking-wider mb-1">Current Balance</p>
                  <p className="text-3xl font-extrabold">{formatPrice(parseFloat(creditData?.creditBalance ?? selectedClient.creditBalance ?? "0"))}</p>
                </div>
              </div>

              {/* Adjustment form */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold text-foreground text-sm">Adjust Balance</h3>

                <div className="flex gap-1">
                  {([
                    { key: "admin_add",    label: "+ Add",    icon: Plus },
                    { key: "admin_deduct", label: "− Deduct", icon: Minus },
                    { key: "refund",       label: "↩ Refund", icon: RotateCcw },
                  ] as const).map(({ key, label }) => (
                    <button key={key} onClick={() => setAdjustType(key)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${adjustType === key ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">Rs.</span>
                  <Input
                    type="number"
                    min={1}
                    value={adjustAmount}
                    onChange={e => setAdjustAmount(e.target.value)}
                    placeholder="Amount"
                    className="pl-10 h-10 bg-background text-sm"
                  />
                </div>

                <Input
                  value={adjustDesc}
                  onChange={e => setAdjustDesc(e.target.value)}
                  placeholder="Reason / note (optional)"
                  className="h-10 bg-background text-sm"
                />

                <Button
                  className="w-full bg-primary text-white"
                  onClick={() => adjustMutation.mutate()}
                  disabled={adjustMutation.isPending || !adjustAmount || parseFloat(adjustAmount) <= 0}
                >
                  {adjustMutation.isPending
                    ? <><Loader2 size={13} className="animate-spin mr-1.5" /> Processing…</>
                    : "Apply Adjustment"
                  }
                </Button>
              </div>

              {/* Recent transactions */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h3 className="font-semibold text-foreground text-sm">Transaction History</h3>
                {creditLoading ? (
                  <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-primary" /></div>
                ) : txs.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {txs.map((tx: any) => {
                      const isIn = ["admin_add", "affiliate_payout", "refund", "deposit"].includes(tx.type);
                      return (
                        <div key={tx.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/20 text-sm">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isIn ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                              {isIn ? <ArrowDownLeft size={13} className="text-emerald-500" /> : <ArrowUpRight size={13} className="text-red-400" />}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground">{TX_LABELS[tx.type] ?? tx.type}</p>
                              {tx.description && <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{tx.description}</p>}
                              <p className="text-[10px] text-muted-foreground">{format(new Date(tx.createdAt), "MMM d, yyyy · h:mm a")}</p>
                            </div>
                          </div>
                          <span className={`font-extrabold text-sm shrink-0 ${isIn ? "text-emerald-500" : "text-red-400"}`}>
                            {isIn ? "+" : "−"}Rs. {parseFloat(tx.amount).toFixed(0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
