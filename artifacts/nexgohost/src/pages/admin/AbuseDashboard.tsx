import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ShieldAlert, ShieldCheck, ShieldX, Clock, Search, AlertTriangle,
  Mail, Ban, CheckCircle2, XCircle, RefreshCw, Eye, Link, FileText,
  Activity, TrendingUp, Users, Server, ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface AbuseStats {
  total: number;
  pending: number;
  warning_sent: number;
  suspended: number;
  resolved: number;
  dismissed: number;
}

interface AbuseAction {
  id: string;
  actionType: string;
  actionNote: string;
  performedBy: string;
  performedByEmail?: string;
  createdAt: string;
}

interface AbuseReport {
  id: string;
  reportNumber: string;
  reporterEmail: string;
  reporterName?: string;
  reporterOrg?: string;
  abuseType: string;
  targetDomain?: string;
  targetIp?: string;
  evidenceLogs: string;
  serviceId?: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  domain?: string;
  status: string;
  isValid?: boolean;
  analysisNotes?: string;
  warningEmailSentAt?: string;
  warningDeadline?: string;
  suspendedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedNote?: string;
  dismissedAt?: string;
  dismissReason?: string;
  ticketId?: string;
  autoSuspended?: boolean;
  actions?: AbuseAction[];
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  spam: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  phishing: "bg-red-500/10 text-red-400 border-red-500/20",
  malware: "bg-red-700/10 text-red-500 border-red-700/20",
  ddos: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  copyright: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  harassment: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  other: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: Clock },
  analyzing: { label: "Analyzing", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Activity },
  warning_sent: { label: "Warning Sent", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: AlertTriangle },
  suspended: { label: "Suspended", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: Ban },
  resolved: { label: "Resolved", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
  dismissed: { label: "Dismissed", color: "bg-gray-500/10 text-gray-300 border-gray-500/20", icon: XCircle },
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  report_submitted: { label: "Report Submitted", color: "text-gray-400" },
  analyzed: { label: "AI Analysis", color: "text-blue-400" },
  warning_sent: { label: "Warning Email Sent", color: "text-yellow-400" },
  suspended: { label: "Service Suspended", color: "text-red-400" },
  auto_suspended: { label: "Auto-Suspended", color: "text-red-500" },
  resolved: { label: "Resolved & Unsuspended", color: "text-green-400" },
  dismissed: { label: "Dismissed", color: "text-gray-400" },
  service_linked: { label: "Service Linked", color: "text-blue-400" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border", cfg.color)}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={cn("inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border capitalize", TYPE_COLORS[type] ?? TYPE_COLORS.other)}>
      {type}
    </span>
  );
}

export default function AbuseDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReport, setSelectedReport] = useState<AbuseReport | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [warnNote, setWarnNote] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [resolveNote, setResolveNote] = useState("");
  const [dismissReason, setDismissReason] = useState("");
  const [linkServiceId, setLinkServiceId] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");

  const { data: stats } = useQuery<AbuseStats>({
    queryKey: ["abuse-stats"],
    queryFn: () => apiFetch("/api/admin/abuse/stats"),
    refetchInterval: 30_000,
  });

  const { data: reports = [], isLoading, refetch } = useQuery<AbuseReport[]>({
    queryKey: ["abuse-reports", statusFilter],
    queryFn: () => apiFetch(`/api/admin/abuse?status=${statusFilter}`),
    refetchInterval: 30_000,
  });

  const { data: reportDetail, isLoading: detailLoading } = useQuery<AbuseReport>({
    queryKey: ["abuse-report-detail", selectedReport?.id],
    queryFn: () => apiFetch(`/api/admin/abuse/${selectedReport?.id}`),
    enabled: !!selectedReport?.id && detailOpen,
  });

  const { data: services = [] } = useQuery<any[]>({
    queryKey: ["abuse-services", serviceSearch],
    queryFn: () => apiFetch(`/api/admin/abuse-services-search?q=${encodeURIComponent(serviceSearch)}`),
    enabled: detailOpen,
  });

  const mutOpts = (label: string, invalidateDetail = true) => ({
    onSuccess: () => {
      toast({ title: `${label} successful` });
      qc.invalidateQueries({ queryKey: ["abuse-reports"] });
      qc.invalidateQueries({ queryKey: ["abuse-stats"] });
      if (invalidateDetail && selectedReport) qc.invalidateQueries({ queryKey: ["abuse-report-detail", selectedReport.id] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const analyzeMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/abuse/${id}/analyze`, { method: "POST" }),
    ...mutOpts("Analysis"),
  });
  const warnMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/abuse/${id}/warn`, { method: "POST", body: JSON.stringify({ note: warnNote }) }),
    ...mutOpts("Warning sent"),
  });
  const suspendMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/abuse/${id}/suspend`, { method: "POST", body: JSON.stringify({ reason: suspendReason }) }),
    ...mutOpts("Service suspended"),
  });
  const resolveMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/abuse/${id}/resolve`, { method: "POST", body: JSON.stringify({ note: resolveNote }) }),
    ...mutOpts("Case resolved"),
  });
  const dismissMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/abuse/${id}/dismiss`, { method: "POST", body: JSON.stringify({ reason: dismissReason }) }),
    ...mutOpts("Report dismissed"),
  });
  const linkMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/abuse/${id}/link-service`, { method: "POST", body: JSON.stringify({ serviceId: linkServiceId }) }),
    ...mutOpts("Service linked"),
  });

  const filtered = reports.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.reportNumber.toLowerCase().includes(q) ||
      r.reporterEmail.toLowerCase().includes(q) ||
      (r.domain || r.targetDomain || "").toLowerCase().includes(q) ||
      (r.clientName || "").toLowerCase().includes(q);
  });

  const openDetail = (r: AbuseReport) => {
    setSelectedReport(r);
    setDetailOpen(true);
    setSuspendReason("");
    setResolveNote("");
    setDismissReason("");
    setWarnNote("");
  };

  const d = reportDetail ?? selectedReport;
  const isActive = d && !["resolved", "dismissed"].includes(d.status);

  const STAT_CARDS = [
    { label: "Total Reports", value: stats?.total ?? 0, icon: ShieldAlert, color: "text-primary", bg: "bg-primary/10" },
    { label: "Pending Review", value: stats?.pending ?? 0, icon: Clock, color: "text-gray-400", bg: "bg-gray-500/10" },
    { label: "Warnings Sent", value: stats?.warning_sent ?? 0, icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "Suspended", value: stats?.suspended ?? 0, icon: Ban, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "Resolved", value: stats?.resolved ?? 0, icon: ShieldCheck, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Dismissed", value: stats?.dismissed ?? 0, icon: ShieldX, color: "text-gray-500", bg: "bg-gray-700/20" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-red-400" />
            Abuse Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">Monitor and enforce abuse & spam policy across all hosted services</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className={cn("inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2", bg)}>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 bg-card border-border" placeholder="Search by report #, email, domain, or client..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "analyzing", "warning_sent", "suspended", "resolved", "dismissed"].map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
              className={cn("text-xs capitalize", statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border-border text-muted-foreground")}>
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label ?? s}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Report #</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Reporter</th>
                  <th className="text-left px-4 py-3 font-medium">Domain / Client</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Received</th>
                  <th className="text-left px-4 py-3 font-medium">Deadline</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                      Loading reports...
                    </div>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">No abuse reports found</p>
                    <p className="text-xs mt-1">All clear — no active abuse complaints match this filter</p>
                  </td></tr>
                ) : filtered.map(r => {
                  const deadline = r.warningDeadline ? new Date(r.warningDeadline) : null;
                  const isOverdue = deadline && deadline < new Date() && r.status === "warning_sent";
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-accent/5 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium text-primary">{r.reportNumber}</span>
                      </td>
                      <td className="px-4 py-3"><TypeBadge type={r.abuseType} /></td>
                      <td className="px-4 py-3">
                        <p className="text-foreground text-xs font-medium truncate max-w-[150px]">{r.reporterName || r.reporterEmail}</p>
                        {r.reporterName && <p className="text-muted-foreground text-xs truncate max-w-[150px]">{r.reporterEmail}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-foreground text-xs font-medium">{r.domain || r.targetDomain || <span className="text-muted-foreground italic">Not linked</span>}</p>
                        {r.clientName && <p className="text-muted-foreground text-xs">{r.clientName}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                        {r.autoSuspended && <span className="ml-1 text-[10px] text-red-400/70 font-medium">AUTO</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {deadline ? (
                          <span className={cn("font-medium", isOverdue ? "text-red-400" : "text-yellow-400")}>
                            {isOverdue ? "⚠ Overdue" : formatDistanceToNow(deadline, { addSuffix: true })}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-foreground" onClick={() => openDetail(r)}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <ShieldAlert className="h-5 w-5 text-red-400" />
              {d?.reportNumber} — Abuse Report Detail
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : d ? (
            <div className="space-y-5">
              {/* Status + Type Row */}
              <div className="flex flex-wrap gap-2 items-center">
                <StatusBadge status={d.status} />
                <TypeBadge type={d.abuseType} />
                {d.autoSuspended && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">Auto-Suspended</Badge>}
                {d.isValid === true && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">⚠ AI: Valid Complaint</Badge>}
                {d.isValid === false && <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20 text-xs">AI: Likely False Positive</Badge>}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Report Number", value: d.reportNumber, mono: true },
                  { label: "Abuse Type", value: d.abuseType, cap: true },
                  { label: "Reporter", value: d.reporterName ? `${d.reporterName} (${d.reporterEmail})` : d.reporterEmail },
                  { label: "Reporter Org", value: d.reporterOrg || "—" },
                  { label: "Target Domain", value: d.domain || d.targetDomain || "—" },
                  { label: "Target IP", value: d.targetIp || "—" },
                  { label: "Linked Client", value: d.clientName || "Not linked" },
                  { label: "Client Email", value: d.clientEmail || "—" },
                  { label: "Reported At", value: format(new Date(d.createdAt), "PPP p") },
                  { label: "Warning Deadline", value: d.warningDeadline ? format(new Date(d.warningDeadline), "PPP p") : "—" },
                ].map(({ label, value, mono, cap }) => (
                  <div key={label} className="bg-background/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className={cn("text-foreground text-sm font-medium break-all", mono && "font-mono", cap && "capitalize")}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Evidence */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Evidence Logs</p>
                <div className="bg-background/40 border border-border rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto font-mono text-xs leading-relaxed">
                  {d.evidenceLogs}
                </div>
              </div>

              {/* AI Analysis */}
              {d.analysisNotes && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-xs text-blue-400 font-medium mb-1 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> AI Analysis Result</p>
                  <p className="text-sm text-foreground">{d.analysisNotes}</p>
                </div>
              )}

              {/* Resolution Info */}
              {d.resolvedNote && (
                <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                  <p className="text-xs text-green-400 font-medium mb-1">Resolution Note</p>
                  <p className="text-sm text-foreground">{d.resolvedNote}</p>
                </div>
              )}
              {d.dismissReason && (
                <div className="bg-gray-500/5 border border-gray-500/20 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-medium mb-1">Dismissal Reason</p>
                  <p className="text-sm text-foreground">{d.dismissReason}</p>
                </div>
              )}

              {/* Actions */}
              {isActive && (
                <div className="border border-border rounded-lg p-4 space-y-4">
                  <p className="text-sm font-semibold text-foreground">Admin Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {/* Analyze */}
                    {["pending", "analyzing"].includes(d.status) && (
                      <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                        disabled={analyzeMut.isPending}
                        onClick={() => analyzeMut.mutate(d.id)}>
                        <Activity className="h-3.5 w-3.5 mr-1" />
                        {analyzeMut.isPending ? "Analyzing..." : "Run AI Analysis"}
                      </Button>
                    )}
                    {/* Link Service */}
                    {!d.serviceId && (
                      <div className="w-full flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground mb-1 block">Link Hosting Service</Label>
                          <div className="flex gap-2">
                            <Input className="h-8 text-xs bg-background border-border"
                              placeholder="Search domain to link..."
                              value={serviceSearch}
                              onChange={e => setServiceSearch(e.target.value)} />
                            <Select value={linkServiceId} onValueChange={setLinkServiceId}>
                              <SelectTrigger className="h-8 text-xs w-48 bg-background border-border">
                                <SelectValue placeholder="Select service" />
                              </SelectTrigger>
                              <SelectContent>
                                {services.map((s: any) => (
                                  <SelectItem key={s.id} value={s.id}>{s.domain || s.id} ({s.status})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" className="h-8"
                              disabled={!linkServiceId || linkMut.isPending}
                              onClick={() => linkMut.mutate(d.id)}>
                              <Link className="h-3.5 w-3.5 mr-1" /> Link
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Send Warning */}
                    {["pending", "analyzing"].includes(d.status) && d.clientId && (
                      <div className="w-full space-y-2">
                        <Label className="text-xs text-muted-foreground">Warning Note (optional)</Label>
                        <div className="flex gap-2">
                          <Input className="h-8 text-xs bg-background border-border flex-1" placeholder="Additional note to include..."
                            value={warnNote} onChange={e => setWarnNote(e.target.value)} />
                          <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white h-8"
                            disabled={warnMut.isPending}
                            onClick={() => warnMut.mutate(d.id)}>
                            <Mail className="h-3.5 w-3.5 mr-1" />
                            {warnMut.isPending ? "Sending..." : "Send Warning Email"}
                          </Button>
                        </div>
                      </div>
                    )}
                    {/* Suspend */}
                    {["pending", "analyzing", "warning_sent"].includes(d.status) && (
                      <div className="w-full space-y-2">
                        <Label className="text-xs text-muted-foreground">Suspension Reason</Label>
                        <div className="flex gap-2">
                          <Input className="h-8 text-xs bg-background border-border flex-1"
                            placeholder="e.g. Abuse policy violation — repeated spam"
                            value={suspendReason} onChange={e => setSuspendReason(e.target.value)} />
                          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-8"
                            disabled={suspendMut.isPending}
                            onClick={() => suspendMut.mutate(d.id)}>
                            <Ban className="h-3.5 w-3.5 mr-1" />
                            {suspendMut.isPending ? "Suspending..." : "Suspend Service"}
                          </Button>
                        </div>
                      </div>
                    )}
                    {/* Resolve */}
                    <div className="w-full space-y-2">
                      <Label className="text-xs text-muted-foreground">Resolution Note</Label>
                      <div className="flex gap-2">
                        <Input className="h-8 text-xs bg-background border-border flex-1"
                          placeholder="e.g. Client resolved the issue, service unsuspended"
                          value={resolveNote} onChange={e => setResolveNote(e.target.value)} />
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8"
                          disabled={resolveMut.isPending}
                          onClick={() => resolveMut.mutate(d.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          {resolveMut.isPending ? "Resolving..." : "Resolve & Unsuspend"}
                        </Button>
                      </div>
                    </div>
                    {/* Dismiss */}
                    {["pending", "analyzing"].includes(d.status) && (
                      <div className="w-full space-y-2">
                        <Label className="text-xs text-muted-foreground">Dismiss Reason</Label>
                        <div className="flex gap-2">
                          <Input className="h-8 text-xs bg-background border-border flex-1"
                            placeholder="e.g. False positive, no evidence of abuse"
                            value={dismissReason} onChange={e => setDismissReason(e.target.value)} />
                          <Button size="sm" variant="outline" className="border-gray-500/30 text-gray-400 hover:bg-gray-500/10 h-8"
                            disabled={dismissMut.isPending}
                            onClick={() => dismissMut.mutate(d.id)}>
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            {dismissMut.isPending ? "Dismissing..." : "Dismiss"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Timeline */}
              {d.actions && d.actions.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-muted-foreground" /> Action Timeline
                  </p>
                  <div className="space-y-2">
                    {d.actions.map((a, i) => {
                      const cfg = ACTION_LABELS[a.actionType] ?? { label: a.actionType, color: "text-muted-foreground" };
                      return (
                        <div key={a.id} className="flex gap-3 text-xs">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-primary/40 mt-1 flex-shrink-0" />
                            {i < d.actions!.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                          </div>
                          <div className="pb-3 flex-1">
                            <span className={cn("font-medium", cfg.color)}>{cfg.label}</span>
                            <span className="text-muted-foreground ml-2">
                              {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })} by {a.performedByEmail || a.performedBy}
                            </span>
                            {a.actionNote && <p className="text-muted-foreground mt-0.5 leading-relaxed">{a.actionNote}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
