import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { useCurrency } from "@/context/CurrencyProvider";
import {
  Users, DollarSign, Check, X, Settings, TrendingUp, RefreshCw,
  Building2, Wallet, Save, Pencil,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AffiliateRow {
  id: string; userId: string; referralCode: string; status: string;
  commissionType: string; commissionValue: string;
  totalEarnings: string; pendingEarnings: string; paidEarnings: string;
  totalClicks: number; totalSignups: number; totalConversions: number;
  firstName: string | null; lastName: string | null; email: string | null;
  notes: string | null; createdAt: string;
}
interface CommissionRow {
  id: string; affiliateId: string; orderId: string | null;
  amount: string; status: string; description: string | null;
  createdAt: string; paidAt: string | null;
  referralCode: string | null; affiliateEmail: string | null;
  firstName: string | null; lastName: string | null;
}
interface WithdrawalRow {
  id: string; affiliateId: string; amount: string; status: string;
  payoutMethod: string; paypalEmail: string | null;
  accountTitle: string | null; accountNumber: string | null; bankName: string | null;
  adminNotes: string | null; createdAt: string;
  referralCode: string | null; firstName: string | null; lastName: string | null; email: string | null;
}
interface GroupCommission {
  groupId: string; groupName: string; commissionType: string;
  commissionValue: string; isActive: boolean; id: string | null;
}
interface PlanItem {
  planId: string; planName: string; planType: string; price: string;
  commission: { commissionType: string; commissionValue: string; isActive: boolean } | null;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    approved: "bg-blue-100 text-blue-700 border-blue-200",
    paid: "bg-green-100 text-green-700 border-green-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
    active: "bg-green-100 text-green-700 border-green-200",
    suspended: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium capitalize ${map[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {status}
    </span>
  );
};

export default function AdminAffiliates() {
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [groupCommissions, setGroupCommissions] = useState<GroupCommission[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [planEdits, setPlanEdits] = useState<Record<string, { commissionType: string; commissionValue: string; isActive: boolean }>>({});
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings state
  const [payoutThreshold, setPayoutThreshold] = useState("2000");
  const [cookieDays, setCookieDays] = useState("30");
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Edit affiliate dialog
  const [editAff, setEditAff] = useState<AffiliateRow | null>(null);
  const [editStatus, setEditStatus] = useState("active");
  const [editCommType, setEditCommType] = useState("fixed");
  const [editCommValue, setEditCommValue] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Withdraw action dialog
  const [withdrawDialog, setWithdrawDialog] = useState<{ w: WithdrawalRow; action: "approve" | "pay" | "reject" } | null>(null);
  const [withdrawNote, setWithdrawNote] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // Commission action loading
  const [commLoading, setCommLoading] = useState<string | null>(null);

  // Group commission edit
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [groupEdits, setGroupEdits] = useState<Record<string, { commissionType: string; commissionValue: string }>>({});

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [affs, comms, wds, grpComms, sett, planComms] = await Promise.all([
        apiFetch("/api/admin/affiliates"),
        apiFetch("/api/admin/affiliates/commissions/all"),
        apiFetch("/api/admin/affiliates/withdrawals/all"),
        apiFetch("/api/admin/affiliates/group-commissions"),
        apiFetch("/api/admin/affiliates/settings"),
        apiFetch("/api/admin/affiliates/plan-commissions"),
      ]);
      setAffiliates(affs.affiliates || []);
      setCommissions(comms.commissions || []);
      setWithdrawals(wds.withdrawals || []);
      setGroupCommissions(grpComms.groupCommissions || []);
      setPlanItems(planComms.plans || []);
      setPayoutThreshold(String(sett.payoutThreshold ?? 2000));
      setCookieDays(String(sett.cookieDays ?? 30));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Settings ─────────────────────────────────────────────────────────────────
  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      await apiFetch("/api/admin/affiliates/settings", {
        method: "PUT",
        body: JSON.stringify({ payoutThreshold: parseFloat(payoutThreshold), cookieDays: parseInt(cookieDays) }),
      });
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSettingsSaving(false); }
  };

  // ── Group Commissions ──────────────────────────────────────────────────────────
  const saveGroupCommission = async (groupId: string, groupName: string) => {
    const edit = groupEdits[groupId];
    if (!edit) return;
    try {
      await apiFetch(`/api/admin/affiliates/group-commissions/${groupId}`, {
        method: "PUT",
        body: JSON.stringify({ commissionType: edit.commissionType, commissionValue: edit.commissionValue, groupName }),
      });
      toast({ title: "Commission rate updated" });
      setEditingGroup(null);
      fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // ── Edit Affiliate ─────────────────────────────────────────────────────────────
  const openEditAff = (a: AffiliateRow) => {
    setEditAff(a);
    setEditStatus(a.status);
    setEditCommType(a.commissionType);
    setEditCommValue(a.commissionValue);
    setEditNotes(a.notes ?? "");
  };
  const saveEditAff = async () => {
    if (!editAff) return;
    setEditSaving(true);
    try {
      await apiFetch(`/api/admin/affiliates/${editAff.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: editStatus, commissionType: editCommType, commissionValue: editCommValue, notes: editNotes }),
      });
      toast({ title: "Affiliate updated" });
      setEditAff(null);
      fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setEditSaving(false); }
  };

  // ── Commission Actions ──────────────────────────────────────────────────────────
  const handleCommissionAction = async (id: string, action: "approve" | "reject" | "pay") => {
    setCommLoading(id + action);
    try {
      await apiFetch(`/api/admin/affiliates/commissions/${id}/${action}`, { method: "PUT" });
      toast({ title: action === "approve" ? "Commission approved" : action === "reject" ? "Commission rejected" : "Commission marked as paid" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setCommLoading(null); }
  };

  // ── Withdrawal Actions ──────────────────────────────────────────────────────────
  const handleWithdrawalAction = async () => {
    if (!withdrawDialog) return;
    const { w, action } = withdrawDialog;
    setWithdrawLoading(true);
    try {
      await apiFetch(`/api/admin/affiliates/withdrawals/${w.id}/${action}`, {
        method: "PUT",
        body: JSON.stringify({ adminNotes: withdrawNote || undefined }),
      });
      toast({ title: action === "approve" ? "Withdrawal approved" : action === "pay" ? "Marked as paid" : "Withdrawal rejected" });
      setWithdrawDialog(null);
      setWithdrawNote("");
      fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setWithdrawLoading(false); }
  };

  // ── Summary Stats ──────────────────────────────────────────────────────────────
  const totalPending = commissions.filter(c => c.status === "pending").length;
  const totalWithdrawalsPending = withdrawals.filter(w => w.status === "pending").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Affiliate Management</h1>
        <p className="text-gray-500 mt-1">Manage affiliates, commissions, and payouts</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Affiliates", value: affiliates.length, icon: Users, color: "text-purple-500" },
          { label: "Pending Commissions", value: totalPending, icon: DollarSign, color: "text-yellow-500" },
          { label: "Pending Withdrawals", value: totalWithdrawalsPending, icon: Building2, color: "text-blue-500" },
          { label: "Total Conversions", value: affiliates.reduce((a, b) => a + b.totalConversions, 0), icon: TrendingUp, color: "text-green-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
              <Icon className={`h-6 w-6 ${color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="h-6 w-6 animate-spin text-purple-600" />
        </div>
      ) : (
        <Tabs defaultValue="affiliates">
          <TabsList>
            <TabsTrigger value="affiliates">Affiliates ({affiliates.length})</TabsTrigger>
            <TabsTrigger value="commissions">
              Commissions {totalPending > 0 && <span className="ml-1 bg-yellow-500 text-white text-xs rounded-full px-1.5">{totalPending}</span>}
            </TabsTrigger>
            <TabsTrigger value="withdrawals">
              Withdrawals {totalWithdrawalsPending > 0 && <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1.5">{totalWithdrawalsPending}</span>}
            </TabsTrigger>
            <TabsTrigger value="plan-commissions"><DollarSign className="h-3.5 w-3.5 mr-1" />Plan Rates</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="h-3.5 w-3.5 mr-1" />Settings</TabsTrigger>
          </TabsList>

          {/* ── Affiliates Tab ── */}
          <TabsContent value="affiliates">
            <Card>
              <CardContent className="pt-4">
                {affiliates.length === 0 ? (
                  <p className="text-center text-gray-400 py-10">No affiliates yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2 pr-4 font-medium">Affiliate</th>
                          <th className="pb-2 pr-4 font-medium">Code</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 pr-4 font-medium">Commission</th>
                          <th className="pb-2 pr-4 font-medium">Clicks/Conv</th>
                          <th className="pb-2 pr-4 font-medium">Earnings</th>
                          <th className="pb-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {affiliates.map(a => {
                          const avail = Math.max(
                            parseFloat(a.totalEarnings || "0") - parseFloat(a.pendingEarnings || "0") - parseFloat(a.paidEarnings || "0"), 0
                          );
                          return (
                            <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="py-3 pr-4">
                                <p className="font-medium text-gray-800">{a.firstName} {a.lastName}</p>
                                <p className="text-xs text-gray-400">{a.email}</p>
                              </td>
                              <td className="py-3 pr-4 font-mono text-xs text-purple-600">{a.referralCode}</td>
                              <td className="py-3 pr-4"><StatusBadge status={a.status} /></td>
                              <td className="py-3 pr-4 text-xs">
                                {a.commissionType === "percentage" ? `${a.commissionValue}%` : formatPrice(parseFloat(a.commissionValue))}
                              </td>
                              <td className="py-3 pr-4 text-xs text-gray-500">{a.totalClicks} / {a.totalConversions}</td>
                              <td className="py-3 pr-4">
                                <p className="text-xs text-gray-500">Total: {formatPrice(parseFloat(a.totalEarnings || "0"))}</p>
                                <p className="text-xs text-green-600">Avail: {formatPrice(avail)}</p>
                              </td>
                              <td className="py-3">
                                <Button variant="ghost" size="sm" onClick={() => openEditAff(a)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Commissions Tab ── */}
          <TabsContent value="commissions">
            <Card>
              <CardContent className="pt-4">
                {commissions.length === 0 ? (
                  <p className="text-center text-gray-400 py-10">No commissions yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2 pr-4 font-medium">Affiliate</th>
                          <th className="pb-2 pr-4 font-medium">Description</th>
                          <th className="pb-2 pr-4 font-medium">Amount</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 pr-4 font-medium">Date</th>
                          <th className="pb-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissions.map(c => (
                          <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-gray-800">{c.firstName} {c.lastName}</p>
                              <p className="text-xs text-gray-400 font-mono">{c.referralCode}</p>
                            </td>
                            <td className="py-3 pr-4 text-xs text-gray-600 max-w-[200px]">{c.description || "—"}</td>
                            <td className="py-3 pr-4 font-semibold">{formatPrice(parseFloat(c.amount))}</td>
                            <td className="py-3 pr-4"><StatusBadge status={c.status} /></td>
                            <td className="py-3 pr-4 text-xs text-gray-400">{fmtDate(c.createdAt)}</td>
                            <td className="py-3">
                              <div className="flex gap-1">
                                {c.status === "pending" && (
                                  <>
                                    <Button
                                      size="sm" variant="outline"
                                      className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                                      disabled={commLoading === c.id + "approve"}
                                      onClick={() => handleCommissionAction(c.id, "approve")}
                                    >
                                      {commLoading === c.id + "approve" ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm" variant="outline"
                                      className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                                      disabled={commLoading === c.id + "reject"}
                                      onClick={() => handleCommissionAction(c.id, "reject")}
                                    >
                                      {commLoading === c.id + "reject" ? <RefreshCw className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3 mr-1" />}
                                      Reject
                                    </Button>
                                  </>
                                )}
                                {c.status === "approved" && (
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                    disabled={commLoading === c.id + "pay"}
                                    onClick={() => handleCommissionAction(c.id, "pay")}
                                  >
                                    Mark Paid
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Withdrawals Tab ── */}
          <TabsContent value="withdrawals">
            <Card>
              <CardContent className="pt-4">
                {withdrawals.length === 0 ? (
                  <p className="text-center text-gray-400 py-10">No withdrawals yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2 pr-4 font-medium">Affiliate</th>
                          <th className="pb-2 pr-4 font-medium">Method / Details</th>
                          <th className="pb-2 pr-4 font-medium">Amount</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 pr-4 font-medium">Date</th>
                          <th className="pb-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.map(w => (
                          <tr key={w.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-gray-800">{w.firstName} {w.lastName}</p>
                              <p className="text-xs text-gray-400">{w.email}</p>
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-1 text-xs">
                                {w.payoutMethod === "wallet"
                                  ? <><Wallet className="h-3.5 w-3.5 text-purple-500" /> Wallet</>
                                  : <><Building2 className="h-3.5 w-3.5 text-blue-500" /> {w.bankName || "Bank"}</>}
                              </div>
                              {w.payoutMethod !== "wallet" && (
                                <>
                                  {w.accountTitle && <p className="text-xs text-gray-500">{w.accountTitle}</p>}
                                  {w.accountNumber && <p className="text-xs font-mono text-gray-400">{w.accountNumber}</p>}
                                </>
                              )}
                              {w.adminNotes && <p className="text-xs text-gray-400 italic mt-0.5">{w.adminNotes}</p>}
                            </td>
                            <td className="py-3 pr-4 font-semibold">{formatPrice(parseFloat(w.amount))}</td>
                            <td className="py-3 pr-4"><StatusBadge status={w.status} /></td>
                            <td className="py-3 pr-4 text-xs text-gray-400">{fmtDate(w.createdAt)}</td>
                            <td className="py-3">
                              <div className="flex gap-1">
                                {w.status === "pending" && (
                                  <>
                                    <Button
                                      size="sm" variant="outline"
                                      className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                                      onClick={() => { setWithdrawDialog({ w, action: "approve" }); setWithdrawNote(""); }}
                                    >
                                      <Check className="h-3 w-3 mr-1" /> Approve
                                    </Button>
                                    <Button
                                      size="sm" variant="outline"
                                      className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                                      onClick={() => { setWithdrawDialog({ w, action: "reject" }); setWithdrawNote(""); }}
                                    >
                                      <X className="h-3 w-3 mr-1" /> Reject
                                    </Button>
                                  </>
                                )}
                                {w.status === "approved" && (
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                    onClick={() => { setWithdrawDialog({ w, action: "pay" }); setWithdrawNote(""); }}
                                  >
                                    Mark Paid
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Plan Commissions Tab ── */}
          <TabsContent value="plan-commissions">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-purple-600" />
                  Per-Plan Commission Rates
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Set a fixed or % commission for each plan. Overrides group-level rates.</p>
              </CardHeader>
              <CardContent>
                {planItems.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">No active plans found.</p>
                ) : (
                  <div className="space-y-2">
                    {planItems.map(p => {
                      const isEditing = editingPlan === p.planId;
                      const edit = planEdits[p.planId] ?? {
                        commissionType: p.commission?.commissionType ?? "fixed",
                        commissionValue: p.commission?.commissionValue ?? "0",
                        isActive: p.commission?.isActive ?? true,
                      };
                      return (
                        <div key={p.planId} className="border rounded-lg p-3 bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-sm">{p.planName}</p>
                              <p className="text-xs text-muted-foreground capitalize">{p.planType} · Rs. {parseFloat(p.price ?? "0").toLocaleString()}/mo</p>
                            </div>
                            {!isEditing ? (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-purple-600"
                                onClick={() => {
                                  setEditingPlan(p.planId);
                                  setPlanEdits(prev => ({
                                    ...prev,
                                    [p.planId]: {
                                      commissionType: p.commission?.commissionType ?? "fixed",
                                      commissionValue: p.commission?.commissionValue ?? "0",
                                      isActive: p.commission?.isActive ?? true,
                                    },
                                  }));
                                }}>
                                <Pencil className="h-3 w-3 mr-1" /> {p.commission ? "Edit" : "Set Rate"}
                              </Button>
                            ) : (
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600"
                                  onClick={async () => {
                                    try {
                                      await apiFetch(`/api/admin/affiliates/plan-commissions/${p.planId}`, {
                                        method: "PUT",
                                        body: JSON.stringify({ planName: p.planName, planType: p.planType, ...edit }),
                                      });
                                      toast({ title: "Saved" });
                                      setEditingPlan(null);
                                      fetchAll();
                                    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
                                  }}>
                                  <Save className="h-3 w-3 mr-1" /> Save
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400" onClick={() => setEditingPlan(null)}>Cancel</Button>
                              </div>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="flex gap-2 flex-wrap items-center">
                              <Select value={edit.commissionType}
                                onValueChange={v => setPlanEdits(pr => ({ ...pr, [p.planId]: { ...edit, commissionType: v } }))}>
                                <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fixed">Fixed (Rs.)</SelectItem>
                                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input type="number" min="0" step="1" value={edit.commissionValue}
                                onChange={e => setPlanEdits(pr => ({ ...pr, [p.planId]: { ...edit, commissionValue: e.target.value } }))}
                                className="h-8 text-xs w-28" placeholder="Amount" />
                              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                <input type="checkbox" checked={edit.isActive}
                                  onChange={e => setPlanEdits(pr => ({ ...pr, [p.planId]: { ...edit, isActive: e.target.checked } }))} />
                                Active
                              </label>
                            </div>
                          ) : (
                            <p className="text-sm font-semibold text-purple-700">
                              {p.commission && parseFloat(p.commission.commissionValue) > 0
                                ? p.commission.commissionType === "percentage"
                                  ? `${p.commission.commissionValue}% per order`
                                  : `Rs. ${parseFloat(p.commission.commissionValue).toLocaleString()} per order`
                                : <span className="text-muted-foreground font-normal text-xs">No specific rate set (uses group/default)</span>}
                              {p.commission && !p.commission.isActive && <span className="ml-2 text-xs text-muted-foreground">(disabled)</span>}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Settings Tab ── */}
          <TabsContent value="settings">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Global settings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="h-4 w-4 text-purple-600" />
                    Global Program Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Minimum Payout Threshold (Rs.)</Label>
                    <Input
                      type="number" min="0" step="100"
                      value={payoutThreshold}
                      onChange={e => setPayoutThreshold(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-400 mt-1">Affiliates cannot withdraw below this amount</p>
                  </div>
                  <div>
                    <Label>Referral Cookie Duration (days)</Label>
                    <Input
                      type="number" min="1" max="365"
                      value={cookieDays}
                      onChange={e => setCookieDays(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-400 mt-1">How long the referral cookie persists after clicking the link</p>
                  </div>
                  <Button
                    onClick={saveSettings}
                    disabled={settingsSaving}
                    className="w-full bg-[#4F46E5] hover:bg-[#4338CA]"
                  >
                    {settingsSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Settings
                  </Button>
                </CardContent>
              </Card>

              {/* Group commissions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-purple-600" />
                    Commission Rates by Product Group
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {groupCommissions.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">No product groups configured.</p>
                  ) : (
                    <div className="space-y-3">
                      {groupCommissions.map(g => {
                        const isEditing = editingGroup === g.groupId;
                        const edit = groupEdits[g.groupId] ?? { commissionType: g.commissionType, commissionValue: g.commissionValue };
                        return (
                          <div key={g.groupId} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-sm text-gray-800">{g.groupName}</p>
                              {!isEditing ? (
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-7 text-xs text-purple-600"
                                  onClick={() => {
                                    setEditingGroup(g.groupId);
                                    setGroupEdits(prev => ({
                                      ...prev,
                                      [g.groupId]: { commissionType: g.commissionType, commissionValue: g.commissionValue },
                                    }));
                                  }}
                                >
                                  <Pencil className="h-3 w-3 mr-1" /> Edit
                                </Button>
                              ) : (
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600"
                                    onClick={() => saveGroupCommission(g.groupId, g.groupName)}>
                                    <Save className="h-3 w-3 mr-1" /> Save
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400"
                                    onClick={() => setEditingGroup(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </div>
                            {isEditing ? (
                              <div className="flex gap-2">
                                <Select
                                  value={edit.commissionType}
                                  onValueChange={v => setGroupEdits(p => ({ ...p, [g.groupId]: { ...edit, commissionType: v } }))}
                                >
                                  <SelectTrigger className="h-8 text-xs w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="fixed">Fixed (Rs.)</SelectItem>
                                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number" min="0" step="0.01"
                                  value={edit.commissionValue}
                                  onChange={e => setGroupEdits(p => ({ ...p, [g.groupId]: { ...edit, commissionValue: e.target.value } }))}
                                  className="h-8 text-xs"
                                />
                              </div>
                            ) : (
                              <p className="text-sm text-purple-700 font-semibold">
                                {g.commissionType === "percentage"
                                  ? `${g.commissionValue}% per order`
                                  : `${formatPrice(parseFloat(g.commissionValue))} per order`}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Edit Affiliate Dialog */}
      <Dialog open={!!editAff} onOpenChange={o => { if (!o) setEditAff(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Affiliate</DialogTitle>
            <DialogDescription>{editAff?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Commission Type</Label>
                <Select value={editCommType} onValueChange={setEditCommType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed (Rs.)</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Commission Value</Label>
                <Input type="number" min="0" step="0.01"
                  value={editCommValue} onChange={e => setEditCommValue(e.target.value)}
                  className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Internal Notes</Label>
              <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAff(null)}>Cancel</Button>
            <Button onClick={saveEditAff} disabled={editSaving} className="bg-[#4F46E5] hover:bg-[#4338CA]">
              {editSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Action Dialog */}
      <Dialog open={!!withdrawDialog} onOpenChange={o => { if (!o) setWithdrawDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {withdrawDialog?.action === "approve" ? "Approve Withdrawal"
                : withdrawDialog?.action === "pay" ? "Mark as Paid"
                  : "Reject Withdrawal"}
            </DialogTitle>
            {withdrawDialog && (
              <DialogDescription>
                {formatPrice(parseFloat(withdrawDialog.w.amount))} — {withdrawDialog.w.firstName} {withdrawDialog.w.lastName}
                {withdrawDialog.w.payoutMethod !== "wallet" && withdrawDialog.w.bankName && (
                  <> via {withdrawDialog.w.bankName}</>
                )}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="py-2">
            <Label>Admin Note (optional)</Label>
            <Textarea
              value={withdrawNote}
              onChange={e => setWithdrawNote(e.target.value)}
              placeholder="Add a note for the affiliate..."
              className="mt-1"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawDialog(null)}>Cancel</Button>
            <Button
              onClick={handleWithdrawalAction}
              disabled={withdrawLoading}
              className={withdrawDialog?.action === "reject"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-[#4F46E5] hover:bg-[#4338CA]"}
            >
              {withdrawLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              {withdrawDialog?.action === "approve" ? "Approve" : withdrawDialog?.action === "pay" ? "Mark Paid" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
