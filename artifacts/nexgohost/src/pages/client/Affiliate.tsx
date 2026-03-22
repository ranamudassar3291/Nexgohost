import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Link2, TrendingUp, DollarSign, Copy, Check, ExternalLink, AlertCircle, Loader2, Share2, Gift } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<string | null>(null);

  const baseUrl = window.location.origin;

  useEffect(() => {
    apiFetch("/api/affiliate")
      .then(d => {
        setData(d);
        setPaypalEmail(d.affiliate?.paypalEmail || "");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
          { label: "Pending", value: affiliate.pendingEarnings, color: "text-yellow-400" },
          { label: "Approved", value: String(parseFloat(affiliate.totalEarnings || "0") - parseFloat(affiliate.pendingEarnings || "0") - parseFloat(affiliate.paidEarnings || "0")), color: "text-blue-400" },
          { label: "Paid Out", value: affiliate.paidEarnings, color: "text-green-400" },
        ].map(e => (
          <div key={e.label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{e.label} Earnings</p>
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
