import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, Link2, TrendingUp, DollarSign, Copy, Check, ExternalLink,
  AlertCircle, Loader2, Share2, Gift, ArrowDownCircle, Clock, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/context/CurrencyProvider";
import { apiFetch } from "@/lib/api";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    approved: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    paid: "bg-green-500/10 text-green-400 border-green-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    registered: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    converted: "bg-green-500/10 text-green-400 border-green-500/20",
    validating: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${map[status] || "bg-secondary text-muted-foreground border-transparent"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function Affiliate() {
  const { formatPrice } = useCurrency();
  const [data, setData] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferMsg, setTransferMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const baseUrl = window.location.origin;

  const loadData = async () => {
    try {
      const [aff, wdraw] = await Promise.all([
        apiFetch("/api/affiliate"),
        apiFetch("/api/affiliate/withdrawals"),
      ]);
      setData(aff);
      setPaypalEmail(aff.affiliate?.paypalEmail || "");
      setWithdrawals(wdraw.withdrawals || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const referralLink = data ? `${baseUrl}/register?ref=${data.affiliate.referralCode}` : "";

  const copy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const savePayout = async () => {
    setSavingPayout(true);
    setPayoutMsg(null);
    try {
      await apiFetch("/api/affiliate", { method: "PUT", body: JSON.stringify({ paypalEmail }) });
      setPayoutMsg("Payout info saved.");
    } catch (e: any) {
      setPayoutMsg(e.message || "Failed to save.");
    } finally {
      setSavingPayout(false);
    }
  };

  const requestWithdrawal = async () => {
    setWithdrawing(true);
    setWithdrawMsg(null);
    try {
      await apiFetch("/api/affiliate/withdraw", {
        method: "POST",
        body: JSON.stringify({ amount: parseFloat(withdrawAmount) }),
      });
      setWithdrawMsg({ type: "ok", text: "Withdrawal request submitted! Admin will process it shortly." });
      setWithdrawAmount("");
      loadData();
    } catch (e: any) {
      setWithdrawMsg({ type: "err", text: e.message || "Failed to submit withdrawal." });
    } finally {
      setWithdrawing(false);
    }
  };

  const transferToWallet = async () => {
    setTransferring(true);
    setTransferMsg(null);
    try {
      const res = await apiFetch("/api/affiliate/transfer-to-wallet", {
        method: "POST",
        body: JSON.stringify({ amount: parseFloat(transferAmount) }),
      });
      setTransferMsg({ type: "ok", text: `Rs. ${parseFloat(res.transferred).toFixed(0)} transferred to your wallet instantly!` });
      setTransferAmount("");
      loadData();
    } catch (e: any) {
      setTransferMsg({ type: "err", text: e.message || "Failed to transfer." });
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive">
        <AlertCircle size={18} /> {error}
      </div>
    );
  }

  const { affiliate, commissions = [], referrals = [] } = data;

  const approvedBalance = parseFloat(affiliate.totalEarnings || "0")
    - parseFloat(affiliate.pendingEarnings || "0")
    - parseFloat(affiliate.paidEarnings || "0");

  const stats = [
    { label: "Total Clicks", value: affiliate.totalClicks, icon: TrendingUp, color: "text-blue-400" },
    { label: "Signups", value: affiliate.totalSignups, icon: Users, color: "text-purple-400" },
    { label: "Conversions", value: affiliate.totalConversions, icon: Gift, color: "text-green-400" },
    { label: "Total Earnings", value: formatPrice(parseFloat(affiliate.totalEarnings || "0")), icon: DollarSign, color: "text-yellow-400" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Affiliate Program</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Earn {affiliate.commissionType === "percentage" ? `${affiliate.commissionValue}%` : formatPrice(parseFloat(affiliate.commissionValue))} commission on every referral purchase
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={16} className={s.color} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <div className="text-2xl font-display font-bold text-foreground">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Earnings breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Pending (Awaiting Approval)", value: affiliate.pendingEarnings, color: "text-yellow-400" },
          { label: "Withdrawable Balance", value: String(approvedBalance), color: "text-blue-400" },
          { label: "Total Paid Out", value: affiliate.paidEarnings, color: "text-green-400" },
        ].map(e => (
          <div key={e.label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{e.label}</p>
            <p className={`text-xl font-bold ${e.color}`}>{formatPrice(parseFloat(e.value || "0"))}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 size={18} className="text-primary" />
          <h2 className="font-semibold text-foreground">Your Referral Link</h2>
        </div>
        <div className="flex gap-2">
          <Input
            value={referralLink}
            readOnly
            className="bg-background/60 border-border text-sm font-mono"
          />
          <Button variant="outline" size="icon" onClick={copy} className="shrink-0">
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
          </Button>
          <Button variant="outline" size="icon" asChild className="shrink-0">
            <a href={referralLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} />
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Share this link. When someone registers using it, they're tracked as your referral.
          Commission is generated when they make their first purchase.
        </p>
      </div>

      {/* Payout info */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-primary" />
          <h2 className="font-semibold text-foreground">Payout Information</h2>
        </div>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="your@paypal.com"
            value={paypalEmail}
            onChange={e => setPaypalEmail(e.target.value)}
            className="bg-background/60 border-border"
          />
          <Button onClick={savePayout} disabled={savingPayout} className="shrink-0">
            {savingPayout ? <Loader2 size={14} className="animate-spin" /> : "Save"}
          </Button>
        </div>
        {payoutMsg && <p className="text-xs text-green-400">{payoutMsg}</p>}
        <p className="text-xs text-muted-foreground">Commissions will be paid to this PayPal address once approved by the admin.</p>
      </div>

      {/* Transfer to Wallet (instant) */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-primary" />
          <div>
            <h2 className="font-semibold text-foreground">Transfer to Wallet</h2>
            <p className="text-xs text-muted-foreground">Instantly move earnings to your account wallet — use for any service.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-secondary/40 rounded-xl px-4 py-3 text-sm">
          <span className="text-muted-foreground">Withdrawable balance:</span>
          <span className="font-bold text-blue-400">{formatPrice(approvedBalance)}</span>
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            min="100"
            step="1"
            placeholder="Amount to transfer (min Rs. 100)"
            value={transferAmount}
            onChange={e => setTransferAmount(e.target.value)}
            className="bg-background/60 border-border"
            disabled={transferring}
          />
          <Button
            onClick={transferToWallet}
            disabled={transferring || !transferAmount || parseFloat(transferAmount) < 100 || parseFloat(transferAmount) > approvedBalance}
            className="shrink-0 gap-1 bg-primary"
          >
            {transferring ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
            Transfer
          </Button>
        </div>
        {transferMsg && (
          <p className={`text-xs font-medium ${transferMsg.type === "ok" ? "text-green-400" : "text-red-400"}`}>
            {transferMsg.text}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Minimum transfer: Rs. 100. Earnings are added to your wallet instantly.
        </p>
      </div>

      {/* Withdrawal request */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ArrowDownCircle size={18} className="text-primary" />
          <h2 className="font-semibold text-foreground">Request PayPal Withdrawal</h2>
        </div>
        <div className="flex items-center gap-3 bg-secondary/40 rounded-xl px-4 py-3 text-sm">
          <span className="text-muted-foreground">Withdrawable balance:</span>
          <span className="font-bold text-blue-400">{formatPrice(approvedBalance)}</span>
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            min="1"
            step="0.01"
            placeholder="Amount to withdraw (Rs.)"
            value={withdrawAmount}
            onChange={e => setWithdrawAmount(e.target.value)}
            className="bg-background/60 border-border"
            disabled={withdrawing}
          />
          <Button
            onClick={requestWithdrawal}
            disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
            className="shrink-0 gap-1"
          >
            {withdrawing ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownCircle size={14} />}
            Withdraw
          </Button>
        </div>
        {withdrawMsg && (
          <p className={`text-xs ${withdrawMsg.type === "ok" ? "text-green-400" : "text-red-400"}`}>
            {withdrawMsg.text}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Minimum withdrawal: Rs. 500. Only approved commissions can be withdrawn. You must have a PayPal email saved.
        </p>
      </div>

      {/* Withdrawal history */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <Clock size={18} className="text-primary" />
          <h2 className="font-semibold text-foreground">Withdrawal History</h2>
        </div>
        {withdrawals.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">No withdrawal requests yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">PayPal</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Notes</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {withdrawals.map((w: any) => (
                  <tr key={w.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 font-bold text-foreground">{formatPrice(parseFloat(w.amount))}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">{w.paypalEmail || "—"}</td>
                    <td className="px-5 py-3"><StatusBadge status={w.status} /></td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">{w.adminNotes || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(w.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Referrals table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-primary" />
            <h2 className="font-semibold text-foreground">Your Referrals</h2>
          </div>
        </div>
        {referrals.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">No referrals yet. Share your link to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {referrals.map((r: any) => (
                  <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{r.firstName} {r.lastName}</td>
                    <td className="px-5 py-3 text-muted-foreground">{r.email}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Commissions table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-primary" />
            <h2 className="font-semibold text-foreground">Commission History</h2>
          </div>
        </div>
        {commissions.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">No commissions yet. They appear when referred users make purchases.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commissions.map((c: any) => (
                  <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 text-foreground">{c.description || "Commission"}</td>
                    <td className="px-5 py-3 font-medium text-green-400">{formatPrice(parseFloat(c.amount))}</td>
                    <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
