import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyProvider";
import {
  Copy, Link, TrendingUp, Clock, CheckCircle, Wallet, Building2, Users,
  MousePointerClick, RefreshCw, ArrowUpRight, ChevronDown, ChevronUp,
} from "lucide-react";

interface AffiliateData {
  id: string;
  referralCode: string;
  status: string;
  commissionType: string;
  commissionValue: string;
  totalEarnings: string;
  pendingEarnings: string;
  paidEarnings: string;
  totalClicks: number;
  totalSignups: number;
  totalConversions: number;
  paypalEmail: string | null;
}
interface Commission {
  id: string;
  amount: string;
  status: string;
  description: string | null;
  createdAt: string;
}
interface Referral {
  id: string;
  status: string;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}
interface Withdrawal {
  id: string;
  amount: string;
  status: string;
  payoutMethod: string;
  accountTitle: string | null;
  accountNumber: string | null;
  bankName: string | null;
  createdAt: string;
  adminNotes: string | null;
}
interface GroupCommission {
  groupId: string;
  groupName: string;
  commissionType: string;
  commissionValue: string;
  isActive: boolean;
}
interface Settings {
  payoutThreshold: number;
  cookieDays: number;
  payoutDays: number;
}
interface PlanOffer {
  planId: string;
  planName: string;
  planType: string;
  commissionType: string;
  commissionValue: string;
  yearlyOnly: boolean;
  yearlyPrice: string | null;
}

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    converted: "bg-green-100 text-green-700",
    registered: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${map[s] ?? "bg-gray-100 text-gray-600"}`}>
      {s}
    </span>
  );
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });

export default function Affiliate() {
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [groupCommissions, setGroupCommissions] = useState<GroupCommission[]>([]);
  const [planOffers, setPlanOffers] = useState<PlanOffer[]>([]);
  const [settings, setSettings] = useState<Settings>({ payoutThreshold: 2000, cookieDays: 30 });
  const [loading, setLoading] = useState(true);
  const [activePayoutTab, setActivePayoutTab] = useState<"wallet" | "bank">("wallet");
  const [showAllCommissions, setShowAllCommissions] = useState(false);

  const [walletAmt, setWalletAmt] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);

  const [bankAmt, setBankAmt] = useState("");
  const [bankTitle, setBankTitle] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankLoading, setBankLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [aff, wds, offers] = await Promise.all([
        apiFetch("/api/affiliate"),
        apiFetch("/api/affiliate/withdrawals"),
        apiFetch("/api/affiliate/offers").catch(() => ({ plans: [] })),
      ]);
      setAffiliate(aff.affiliate);
      setCommissions(aff.commissions || []);
      setReferrals(aff.referrals || []);
      setGroupCommissions(aff.groupCommissions || []);
      setSettings(aff.settings || { payoutThreshold: 2000, cookieDays: 30 });
      setWithdrawals(wds.withdrawals || []);
      setPlanOffers(offers.plans || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to load affiliate data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!affiliate) return <div className="p-6 text-center text-gray-500">Failed to load affiliate account.</div>;

  const referralUrl = `${window.location.origin}/?ref=${affiliate.referralCode}`;
  const totalEarnings = parseFloat(affiliate.totalEarnings || "0");
  const pendingEarnings = parseFloat(affiliate.pendingEarnings || "0");
  const paidEarnings = parseFloat(affiliate.paidEarnings || "0");
  const availableBalance = Math.max(totalEarnings - pendingEarnings - paidEarnings, 0);
  const threshold = settings.payoutThreshold;
  const progressPct = Math.min((availableBalance / threshold) * 100, 100);

  const copyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    toast({ title: "Copied!", description: "Referral link copied to clipboard" });
  };
  const copyCode = () => {
    navigator.clipboard.writeText(affiliate.referralCode);
    toast({ title: "Copied!", description: "Referral code copied" });
  };

  const handleWalletTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(walletAmt);
    if (!walletAmt || isNaN(amt) || amt <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    setWalletLoading(true);
    try {
      await apiFetch("/api/affiliate/transfer-to-wallet", null, { method: "POST", body: JSON.stringify({ amount: amt }) });
      toast({ title: "Transferred!", description: `${formatPrice(amt)} added to your wallet` });
      setWalletAmt("");
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Transfer failed", variant: "destructive" });
    } finally { setWalletLoading(false); }
  };

  const handleBankWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(bankAmt);
    if (!bankAmt || isNaN(amt)) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    setBankLoading(true);
    try {
      await apiFetch("/api/affiliate/withdraw", null, {
        method: "POST", body: JSON.stringify({ amount: amt, accountTitle: bankTitle, accountNumber: bankAccount, bankName }),
      });
      toast({ title: "Request submitted!", description: "Your withdrawal will be processed within 3-5 business days." });
      setBankAmt(""); setBankTitle(""); setBankAccount(""); setBankName("");
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Request failed", variant: "destructive" });
    } finally { setBankLoading(false); }
  };

  const displayedCommissions = showAllCommissions ? commissions : commissions.slice(0, 5);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Affiliate Program</h1>
        <p className="text-gray-500 mt-1">Earn commissions by referring clients to our hosting plans.</p>
      </div>

      {/* Referral Link */}
      <Card className="border-purple-100 bg-gradient-to-br from-purple-50 to-white">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Link className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Your Referral Link</p>
              <p className="text-sm text-gray-500">Share this link to start earning commissions</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input value={referralUrl} readOnly className="font-mono text-sm bg-white" />
            <Button onClick={copyLink} className="bg-[#701AFE] hover:bg-[#5e14d4] shrink-0">
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="text-sm text-gray-500">
              Code:{" "}
              <button onClick={copyCode} className="font-mono font-semibold text-purple-700 hover:underline">
                {affiliate.referralCode}
              </button>
            </div>
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {settings.cookieDays}-day cookie tracking
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Available Balance", value: availableBalance, sub: "Ready to withdraw", icon: Wallet, color: "text-green-500" },
          { label: "Pending Commissions", value: pendingEarnings, sub: "Awaiting admin approval", icon: Clock, color: "text-yellow-500" },
          { label: "Total Paid Out", value: paidEarnings, sub: "All-time withdrawals", icon: CheckCircle, color: "text-blue-500" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-500">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(value)}</p>
              <p className="text-xs text-gray-400 mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Traffic Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Clicks", value: affiliate.totalClicks, icon: MousePointerClick, color: "text-orange-500" },
          { label: "Signups", value: affiliate.totalSignups, icon: Users, color: "text-blue-500" },
          { label: "Conversions", value: affiliate.totalConversions, icon: TrendingUp, color: "text-green-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-semibold text-gray-800">Progress to Minimum Payout</p>
              <p className="text-sm text-gray-500">Minimum payout threshold: {formatPrice(threshold)}</p>
            </div>
            <span className="text-sm font-medium text-purple-700">{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-3 [&>div]:bg-[#701AFE]" />
          <p className="text-xs text-gray-400 mt-2">
            {availableBalance >= threshold
              ? "You've reached the minimum payout threshold! You can withdraw now."
              : `${formatPrice(threshold - availableBalance)} more needed to reach the minimum threshold.`}
          </p>
        </CardContent>
      </Card>

      {/* Commission Rates */}
      {groupCommissions.filter(g => g.isActive).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Commission Structure</CardTitle>
            <CardDescription>Earn these commissions for each successful referral per product category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groupCommissions.filter(g => g.isActive).map(g => (
                <div key={g.groupId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="font-medium text-gray-700 text-sm">{g.groupName}</span>
                  <span className="font-bold text-purple-700 text-sm">
                    {g.commissionType === "percentage" ? `${g.commissionValue}%` : formatPrice(parseFloat(g.commissionValue))}
                    <span className="text-xs font-normal text-gray-400 ml-1">/ order</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Offers */}
      {planOffers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Available Offers</CardTitle>
            <CardDescription>Plans with special per-plan commission rates — great ones to promote!</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {planOffers.map(p => (
                <div key={p.planId} className="flex items-center justify-between p-3 rounded-lg border border-purple-100 bg-purple-50">
                  <div>
                    <p className="font-medium text-sm text-gray-800">{p.planName}</p>
                    <p className="text-xs text-gray-500 capitalize">{p.planType} · Rs. {parseFloat(p.price ?? "0").toLocaleString()}/mo</p>
                  </div>
                  <span className="font-bold text-purple-700 text-sm whitespace-nowrap">
                    {p.commissionType === "percentage" ? `${p.commissionValue}%` : `Rs. ${parseFloat(p.commissionValue).toLocaleString()}`}
                    <span className="text-xs font-normal text-gray-400 ml-1">/ order</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Request Payout</CardTitle>
          <CardDescription>Choose how you'd like to receive your affiliate earnings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-5">
            {(["wallet", "bank"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActivePayoutTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                  activePayoutTab === tab
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                }`}
              >
                {tab === "wallet" ? <><Wallet className="h-4 w-4" /> Instant Wallet</> : <><Building2 className="h-4 w-4" /> Bank / JazzCash</>}
              </button>
            ))}
          </div>

          {activePayoutTab === "wallet" && (
            <form onSubmit={handleWalletTransfer} className="space-y-4">
              <div className="p-3 bg-green-50 rounded-lg border border-green-100 text-sm text-green-700">
                <strong>Instant transfer</strong> — Earnings go directly to your account wallet credits.
              </div>
              <div>
                <Label>Transfer Amount (Rs.)</Label>
                <Input
                  type="number" min="100" step="0.01" max={availableBalance}
                  value={walletAmt} onChange={e => setWalletAmt(e.target.value)}
                  placeholder={`Min Rs. 100, Max ${formatPrice(availableBalance)}`}
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 mt-1">Available balance: {formatPrice(availableBalance)}</p>
              </div>
              <Button type="submit" disabled={walletLoading || availableBalance < 100} className="w-full bg-[#701AFE] hover:bg-[#5e14d4]">
                {walletLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <ArrowUpRight className="h-4 w-4 mr-2" />}
                Transfer to Wallet
              </Button>
            </form>
          )}

          {activePayoutTab === "bank" && (
            <form onSubmit={handleBankWithdrawal} className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-700">
                Bank/JazzCash withdrawals processed manually within <strong>3-5 business days</strong>. Min: {formatPrice(threshold)}.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Withdrawal Amount (Rs.)</Label>
                  <Input type="number" min={threshold} step="0.01" max={availableBalance}
                    value={bankAmt} onChange={e => setBankAmt(e.target.value)}
                    placeholder={`Min ${formatPrice(threshold)}`} className="mt-1" />
                </div>
                <div>
                  <Label>Bank / Provider Name</Label>
                  <Input value={bankName} onChange={e => setBankName(e.target.value)}
                    placeholder="e.g. HBL, Meezan, JazzCash" className="mt-1" />
                </div>
                <div>
                  <Label>Account Title</Label>
                  <Input value={bankTitle} onChange={e => setBankTitle(e.target.value)}
                    placeholder="Account holder name" className="mt-1" />
                </div>
                <div>
                  <Label>Account / IBAN Number</Label>
                  <Input value={bankAccount} onChange={e => setBankAccount(e.target.value)}
                    placeholder="Account number or IBAN" className="mt-1" />
                </div>
              </div>
              <Button type="submit" disabled={bankLoading || availableBalance < threshold} className="w-full bg-[#701AFE] hover:bg-[#5e14d4]">
                {bankLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
                Submit Withdrawal Request
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* History Tabs */}
      <Tabs defaultValue="commissions">
        <TabsList>
          <TabsTrigger value="commissions">Commissions ({commissions.length})</TabsTrigger>
          <TabsTrigger value="referrals">Referrals ({referrals.length})</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals ({withdrawals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="commissions">
          <Card>
            <CardContent className="pt-4">
              {commissions.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No commissions yet. Share your link to start earning!</p>
              ) : (
                <>
                  <div className="space-y-0">
                    {displayedCommissions.map(c => (
                      <div key={c.id} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{c.description || "Commission"}</p>
                          <p className="text-xs text-gray-400">{fmtDate(c.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {statusBadge(c.status)}
                          <span className="font-semibold text-gray-900 text-sm">{formatPrice(parseFloat(c.amount))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {commissions.length > 5 && (
                    <Button variant="ghost" size="sm" className="mt-3 w-full text-purple-600"
                      onClick={() => setShowAllCommissions(v => !v)}>
                      {showAllCommissions
                        ? <><ChevronUp className="h-4 w-4 mr-1" /> Show less</>
                        : <><ChevronDown className="h-4 w-4 mr-1" /> Show all {commissions.length}</>}
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals">
          <Card>
            <CardContent className="pt-4">
              {referrals.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No referrals yet.</p>
              ) : (
                <div className="space-y-0">
                  {referrals.map(r => (
                    <div key={r.id} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : r.email || "Anonymous"}
                        </p>
                        <p className="text-xs text-gray-400">{fmtDate(r.createdAt)}</p>
                      </div>
                      {statusBadge(r.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals">
          <Card>
            <CardContent className="pt-4">
              {withdrawals.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No withdrawal requests yet.</p>
              ) : (
                <div className="space-y-0">
                  {withdrawals.map(w => (
                    <div key={w.id} className="flex items-start justify-between py-3 border-b last:border-0">
                      <div>
                        <div className="flex items-center gap-2">
                          {w.payoutMethod === "wallet"
                            ? <Wallet className="h-3.5 w-3.5 text-purple-500" />
                            : <Building2 className="h-3.5 w-3.5 text-blue-500" />}
                          <p className="text-sm font-medium text-gray-800">
                            {w.payoutMethod === "wallet" ? "Wallet Transfer" : `${w.bankName || "Bank"} — ${w.accountTitle || ""}`}
                          </p>
                        </div>
                        {w.accountNumber && <p className="text-xs text-gray-400 ml-5">{w.accountNumber}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(w.createdAt)}</p>
                        {w.adminNotes && <p className="text-xs text-gray-500 mt-1 italic">Note: {w.adminNotes}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        {statusBadge(w.status)}
                        <span className="font-semibold text-gray-900 text-sm">{formatPrice(parseFloat(w.amount))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
