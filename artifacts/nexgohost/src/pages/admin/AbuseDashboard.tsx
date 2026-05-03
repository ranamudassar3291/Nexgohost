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
  Activity, TrendingUp, Users, Server, Zap, Globe, Lock, Scale,
  Database, Network, BarChart3, Star, Skull, ChevronRight,
  Plus, Flame, Target,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AbuseStats {
  total: number; pending: number; warning_sent: number; suspended: number;
  critical_lockdown: number; resolved: number; dismissed: number; avgThreatScore: number;
}

interface AbuseAction {
  id: string; actionType: string; actionNote: string;
  performedBy: string; performedByEmail?: string; createdAt: string;
}

interface AbuseEvidence {
  id: string; reportId: string; fileName?: string; fileUrl?: string;
  mimeType?: string; description?: string; uploadedBy?: string; createdAt: string;
}

interface AbuseReputation {
  clientId: string; totalReports: number; validReports: number; avgThreatScore: number;
  maxThreatScore: number; isPermanentlyBanned: boolean; banReason?: string; lastReportAt?: string;
}

interface AbuseReport {
  id: string; reportNumber: string; reporterEmail: string; reporterName?: string; reporterOrg?: string;
  abuseType: string; targetDomain?: string; targetIp?: string; evidenceLogs: string;
  serviceId?: string; clientId?: string; clientName?: string; clientEmail?: string; domain?: string;
  status: string; isValid?: boolean; analysisNotes?: string;
  threatScore?: number; classification?: string; sourceCredibility?: string;
  isDmca?: boolean; dmcaDeadlineAt?: string; counterNoticeAt?: string; counterNoticeText?: string;
  warningEmailSentAt?: string; warningDeadline?: string; suspendedAt?: string;
  resolvedAt?: string; resolvedBy?: string; resolvedNote?: string;
  dismissedAt?: string; dismissReason?: string;
  ticketId?: string; autoSuspended?: boolean;
  actions?: AbuseAction[]; evidence?: AbuseEvidence[]; reputation?: AbuseReputation;
  createdAt: string;
}

interface NetworkHealth {
  badActors: Array<{ clientId: string; clientName: string; clientEmail: string; totalReports: number; avgThreatScore: number; maxThreatScore: number; isPermanentlyBanned: boolean; lastReportAt?: string }>;
  byType: Array<{ type: string; count: number; avgScore: number }>;
  ipRanges: Array<{ ip: string; count: number; maxScore: number }>;
  topDomains: Array<{ domain: string; count: number; maxScore: number }>;
  highThreat: AbuseReport[];
  scoreDistribution: Array<{ label: string; min: number; max: number; count: number }>;
  totalBanned: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  spam: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  phishing: "bg-red-500/10 text-red-400 border-red-500/20",
  malware: "bg-red-700/10 text-red-500 border-red-700/20",
  ddos: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  copyright: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  dmca: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  child_safety: "bg-pink-700/10 text-pink-400 border-pink-700/20",
  harassment: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  other: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: Clock },
  analyzing: { label: "Analyzing", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Activity },
  warning_sent: { label: "Warning Sent", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: AlertTriangle },
  suspended: { label: "Suspended", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: Ban },
  critical_lockdown: { label: "Critical Lockdown", color: "bg-red-700/10 text-red-300 border-red-700/30", icon: Skull },
  resolved: { label: "Resolved", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
  dismissed: { label: "Dismissed", color: "bg-gray-500/10 text-gray-300 border-gray-500/20", icon: XCircle },
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  report_submitted: { label: "Report Submitted", color: "text-gray-400" },
  analyzed: { label: "Sentinel Analysis", color: "text-blue-400" },
  warning_sent: { label: "Warning Email Sent", color: "text-yellow-400" },
  suspended: { label: "Service Suspended", color: "text-red-400" },
  critical_lockdown: { label: "Critical Lockdown", color: "text-red-300" },
  auto_suspended: { label: "Auto-Suspended", color: "text-red-500" },
  auto_critical_lockdown: { label: "Auto Critical Lockdown", color: "text-red-300" },
  resolved: { label: "Resolved & Unsuspended", color: "text-green-400" },
  dismissed: { label: "Dismissed", color: "text-gray-400" },
  service_linked: { label: "Service Linked", color: "text-blue-400" },
  evidence_added: { label: "Evidence Added", color: "text-purple-400" },
  score_adjusted: { label: "Score Adjusted", color: "text-cyan-400" },
  counter_notice: { label: "Counter-Notice Filed", color: "text-indigo-400" },
  client_counter_notice: { label: "Client Filed Counter-Notice", color: "text-indigo-300" },
  permanent_ban: { label: "Permanently Banned", color: "text-red-300" },
  dmca_auto_takedown: { label: "DMCA Auto-Takedown", color: "text-indigo-400" },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

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
      {type === "child_safety" ? "Child Safety" : type === "dmca" ? "DMCA" : type}
    </span>
  );
}

function ThreatScoreBadge({ score, classification }: { score: number; classification?: string }) {
  const cls = classification || (score >= 90 ? "critical" : score >= 65 ? "high" : score >= 40 ? "medium" : "low");
  const color = cls === "critical" ? "text-red-300 bg-red-700/20 border-red-700/40"
    : cls === "high" ? "text-red-400 bg-red-500/10 border-red-500/20"
    : cls === "medium" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
    : "text-green-400 bg-green-500/10 border-green-500/20";
  const icon = cls === "critical" ? "💀" : cls === "high" ? "🔴" : cls === "medium" ? "🟡" : "🟢";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border font-mono", color)}>
      {icon} {score}/100
    </span>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 90 ? "#dc2626" : pct >= 65 ? "#f97316" : pct >= 40 ? "#eab308" : "#22c55e";
  const bg = pct >= 90 ? "#fef2f2" : pct >= 65 ? "#fff7ed" : pct >= 40 ? "#fefce8" : "#f0fdf4";
  const label = pct >= 90 ? "CRITICAL" : pct >= 65 ? "HIGH" : pct >= 40 ? "MEDIUM" : "LOW";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Threat Score</span>
        <span className="text-sm font-bold" style={{ color }}>{pct}/100 — {label}</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Network Health Tab ────────────────────────────────────────────────────────

function NetworkHealthTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: health, isLoading } = useQuery<NetworkHealth>({
    queryKey: ["abuse-network-health"],
    queryFn: () => apiFetch("/api/admin/abuse/network-health"),
    refetchInterval: 60_000,
  });

  const banMut = useMutation({
    mutationFn: ({ clientId, reason }: { clientId: string; reason: string }) =>
      apiFetch(`/api/admin/abuse/reputation/${clientId}/ban`, { method: "POST", body: JSON.stringify({ banReason: reason }) }),
    onSuccess: () => { toast({ title: "Client permanently banned" }); qc.invalidateQueries({ queryKey: ["abuse-network-health"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unbanMut = useMutation({
    mutationFn: (clientId: string) => apiFetch(`/api/admin/abuse/reputation/${clientId}/unban`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Ban lifted" }); qc.invalidateQueries({ queryKey: ["abuse-network-health"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  const total = health?.scoreDistribution.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Score Distribution */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {health?.scoreDistribution.map(({ label, count, min, max }) => {
          const color = label === "Critical" ? "text-red-300 bg-red-700/10 border-red-700/20"
            : label === "High" ? "text-red-400 bg-red-500/10 border-red-500/20"
            : label === "Medium" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
            : "text-green-400 bg-green-500/10 border-green-500/20";
          const pct = Math.round((count / total) * 100);
          return (
            <Card key={label} className={cn("border", color.split(" ")[2])}>
              <CardContent className="p-4">
                <p className={cn("text-xs font-semibold uppercase tracking-wide mb-1", color.split(" ")[0])}>{label}</p>
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Score {min}–{max} · {pct}%</p>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: label === "Critical" ? "#dc2626" : label === "High" ? "#f97316" : label === "Medium" ? "#eab308" : "#22c55e" }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Bad Actors */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-foreground">
              <Skull className="h-4 w-4 text-red-400" /> Top 10 Bad Actors
              {health?.totalBanned ? <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs ml-auto">{health.totalBanned} Permanently Banned</Badge> : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {health?.badActors.length === 0 && <p className="text-xs text-muted-foreground p-4 text-center">No reputation data yet</p>}
              {health?.badActors.map((actor, i) => (
                <div key={actor.clientId} className="px-4 py-3 flex items-center gap-3 hover:bg-accent/5">
                  <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{actor.clientName}</p>
                    <p className="text-xs text-muted-foreground truncate">{actor.clientEmail}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{actor.totalReports} reports</span>
                      <ThreatScoreBadge score={actor.avgThreatScore} />
                      {actor.isPermanentlyBanned && <Badge className="bg-red-700/20 text-red-300 border-red-700/30 text-[10px]">BANNED</Badge>}
                    </div>
                  </div>
                  {actor.isPermanentlyBanned ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs border-green-500/30 text-green-400"
                      onClick={() => unbanMut.mutate(actor.clientId)} disabled={unbanMut.isPending}>
                      Lift Ban
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-400"
                      onClick={() => { if (confirm(`Permanently ban ${actor.clientName}?`)) banMut.mutate({ clientId: actor.clientId, reason: "Repeated abuse violations" }); }}
                      disabled={banMut.isPending}>
                      <Ban className="h-3 w-3 mr-1" />Ban
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Abuse by Type */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-foreground">
              <BarChart3 className="h-4 w-4 text-primary" /> Abuse by Type
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {health?.byType.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No data yet</p>}
            {health?.byType.sort((a, b) => b.count - a.count).map(({ type, count, avgScore }) => {
              const max = Math.max(...(health?.byType.map(t => t.count) || [1]));
              const pct = Math.round((count / max) * 100);
              const scoreColor = avgScore >= 80 ? "#dc2626" : avgScore >= 50 ? "#f97316" : "#eab308";
              return (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TypeBadge type={type} />
                      <span className="text-xs text-muted-foreground">{count} reports</span>
                    </div>
                    <span className="text-xs font-mono font-bold" style={{ color: scoreColor }}>avg {avgScore}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: scoreColor }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Abused IP Ranges */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-foreground">
              <Network className="h-4 w-4 text-orange-400" /> Most Abused IP Ranges
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {health?.ipRanges.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center">No IP data yet</p>
            ) : (
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border text-muted-foreground uppercase">
                  <th className="text-left px-4 py-2 font-medium">IP Address</th>
                  <th className="text-right px-4 py-2 font-medium">Reports</th>
                  <th className="text-right px-4 py-2 font-medium">Max Score</th>
                </tr></thead>
                <tbody>
                  {health?.ipRanges.map(({ ip, count, maxScore }) => (
                    <tr key={ip} className="border-b border-border last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-2 font-mono text-foreground">{ip}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{count}</td>
                      <td className="px-4 py-2 text-right"><ThreatScoreBadge score={maxScore} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Top Abused Domains */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-foreground">
              <Globe className="h-4 w-4 text-blue-400" /> Most Reported Domains
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {health?.topDomains.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center">No domain data yet</p>
            ) : (
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border text-muted-foreground uppercase">
                  <th className="text-left px-4 py-2 font-medium">Domain</th>
                  <th className="text-right px-4 py-2 font-medium">Reports</th>
                  <th className="text-right px-4 py-2 font-medium">Max Score</th>
                </tr></thead>
                <tbody>
                  {health?.topDomains.map(({ domain, count, maxScore }) => (
                    <tr key={domain} className="border-b border-border last:border-0 hover:bg-accent/5">
                      <td className="px-4 py-2 text-foreground font-medium">{domain}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{count}</td>
                      <td className="px-4 py-2 text-right"><ThreatScoreBadge score={maxScore} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent High-Threat Reports */}
      {(health?.highThreat?.length ?? 0) > 0 && (
        <Card className="bg-card border-border border-red-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-red-400">
              <Flame className="h-4 w-4" /> Recent High-Threat Reports (Score ≥ 70)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-muted-foreground uppercase">
                <th className="text-left px-4 py-2 font-medium">Report</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Domain</th>
                <th className="text-right px-4 py-2 font-medium">Score</th>
                <th className="text-right px-4 py-2 font-medium">Status</th>
              </tr></thead>
              <tbody>
                {health?.highThreat.map(r => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-accent/5">
                    <td className="px-4 py-2 font-mono text-primary">{r.reportNumber}</td>
                    <td className="px-4 py-2"><TypeBadge type={r.abuseType} /></td>
                    <td className="px-4 py-2 text-foreground">{r.targetDomain || "—"}</td>
                    <td className="px-4 py-2 text-right"><ThreatScoreBadge score={r.threatScore ?? 0} classification={r.classification} /></td>
                    <td className="px-4 py-2 text-right"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AbuseDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"reports" | "network">("reports");
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
  const [ticketReply, setTicketReply] = useState("");
  const [scoreAdjust, setScoreAdjust] = useState(-15);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceDesc, setEvidenceDesc] = useState("");
  const [counterNoticeText, setCounterNoticeText] = useState("");

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

  const mutOpts = (label: string) => ({
    onSuccess: () => {
      toast({ title: `${label} successful` });
      qc.invalidateQueries({ queryKey: ["abuse-reports"] });
      qc.invalidateQueries({ queryKey: ["abuse-stats"] });
      qc.invalidateQueries({ queryKey: ["abuse-network-health"] });
      if (selectedReport) qc.invalidateQueries({ queryKey: ["abuse-report-detail", selectedReport.id] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const analyzeMut = useMutation({ mutationFn: (id: string) => apiFetch(`/api/admin/abuse/${id}/analyze`, { method: "POST" }), ...mutOpts("Analysis") });
  const warnMut = useMutation({ mutationFn: (id: string) => apiFetch(`/api/admin/abuse/${id}/warn`, { method: "POST", body: JSON.stringify({ note: warnNote }) }), ...mutOpts("Warning sent") });
  const suspendMut = useMutation({ mutationFn: (id: string) => apiFetch(`/api/admin/abuse/${id}/suspend`, { method: "POST", body: JSON.stringify({ reason: suspendReason }) }), ...mutOpts("Suspended") });
  const resolveMut = useMutation({ mutationFn: (id: string) => apiFetch(`/api/admin/abuse/${id}/resolve`, { method: "POST", body: JSON.stringify({ note: resolveNote }) }), ...mutOpts("Resolved") });
  const dismissMut = useMutation({ mutationFn: (id: string) => apiFetch(`/api/admin/abuse/${id}/dismiss`, { method: "POST", body: JSON.stringify({ reason: dismissReason }) }), ...mutOpts("Dismissed") });
  const linkMut = useMutation({ mutationFn: (id: string) => apiFetch(`/api/admin/abuse/${id}/link-service`, { method: "POST", body: JSON.stringify({ serviceId: linkServiceId }) }), ...mutOpts("Service linked") });
  const scoreAdjustMut = useMutation({ mutationFn: (id: string) => apiFetch(`/api/admin/abuse/${id}/score-adjust`, { method: "POST", body: JSON.stringify({ ticketReply, adjustScore: scoreAdjust }) }), ...mutOpts("Score adjusted") });
  const evidenceMut = useMutation({ mutationFn: (id: string) => apiFetch(`/api/admin/abuse/${id}/evidence`, { method: "POST", body: JSON.stringify({ fileUrl: evidenceUrl, description: evidenceDesc }) }), ...mutOpts("Evidence added") });
  const counterNoticeMut = useMutation({ mutationFn: ({ id, accept }: { id: string; accept: boolean }) => apiFetch(`/api/admin/abuse/${id}/counter-notice`, { method: "POST", body: JSON.stringify({ counterNoticeText, acceptCounterNotice: accept }) }), ...mutOpts("Counter-notice processed") });

  const filtered = reports.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.reportNumber.toLowerCase().includes(q) ||
      r.reporterEmail.toLowerCase().includes(q) ||
      (r.domain || r.targetDomain || "").toLowerCase().includes(q) ||
      (r.clientName || "").toLowerCase().includes(q);
  });

  const openDetail = (r: AbuseReport) => {
    setSelectedReport(r); setDetailOpen(true);
    setSuspendReason(""); setResolveNote(""); setDismissReason(""); setWarnNote("");
    setEvidenceUrl(""); setEvidenceDesc(""); setTicketReply(""); setCounterNoticeText("");
  };

  const d = reportDetail ?? selectedReport;
  const isActive = d && !["resolved", "dismissed"].includes(d.status);

  const STAT_CARDS = [
    { label: "Total Reports", value: stats?.total ?? 0, icon: ShieldAlert, color: "text-primary", bg: "bg-primary/10" },
    { label: "Pending", value: stats?.pending ?? 0, icon: Clock, color: "text-gray-400", bg: "bg-gray-500/10" },
    { label: "Warnings Sent", value: stats?.warning_sent ?? 0, icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "Critical Lockdown", value: stats?.critical_lockdown ?? 0, icon: Skull, color: "text-red-300", bg: "bg-red-700/10" },
    { label: "Suspended", value: stats?.suspended ?? 0, icon: Ban, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "Resolved", value: stats?.resolved ?? 0, icon: ShieldCheck, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Dismissed", value: stats?.dismissed ?? 0, icon: ShieldX, color: "text-gray-500", bg: "bg-gray-700/20" },
    { label: "Avg Threat Score", value: stats?.avgThreatScore ?? 0, icon: Target, color: "text-orange-400", bg: "bg-orange-500/10", suffix: "/100" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-red-400" />
            Autonomous Global Sentinel
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Threat scoring · DMCA workflows · Evidence vault · Network health analytics · Smart enforcement
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["abuse-network-health"] }); }} className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {STAT_CARDS.map(({ label, value, icon: Icon, color, bg, suffix }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-3">
              <div className={cn("inline-flex items-center justify-center w-7 h-7 rounded-lg mb-2", bg)}>
                <Icon className={cn("h-3.5 w-3.5", color)} />
              </div>
              <p className="text-xl font-bold text-foreground">{value}{suffix ?? ""}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-background/40 p-1 rounded-lg border border-border w-fit">
        {[
          { key: "reports", label: "Reports", icon: ShieldAlert },
          { key: "network", label: "Network Health", icon: Network },
        ].map(({ key, label, icon: Icon }) => (
          <Button key={key} size="sm" variant={tab === key ? "default" : "ghost"}
            onClick={() => setTab(key as any)}
            className={cn("text-xs gap-1.5", tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            <Icon className="h-3.5 w-3.5" />{label}
          </Button>
        ))}
      </div>

      {tab === "network" ? <NetworkHealthTab /> : (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 bg-card border-border" placeholder="Search by report #, email, domain, or client..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {["all", "pending", "analyzing", "warning_sent", "critical_lockdown", "suspended", "resolved", "dismissed"].map(s => (
                <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"}
                  onClick={() => setStatusFilter(s)}
                  className={cn("text-xs capitalize", statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border-border text-muted-foreground")}>
                  {s === "all" ? "All" : s === "critical_lockdown" ? "🔴 Critical" : STATUS_CONFIG[s]?.label ?? s}
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
                      <th className="text-left px-4 py-3 font-medium">Threat Score</th>
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
                      <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                          Loading reports...
                        </div>
                      </td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                        <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No abuse reports found</p>
                        <p className="text-xs mt-1">All clear — no active abuse complaints match this filter</p>
                      </td></tr>
                    ) : filtered.map(r => {
                      const deadline = r.warningDeadline ? new Date(r.warningDeadline) : null;
                      const isOverdue = deadline && deadline < new Date() && r.status === "warning_sent";
                      const isCritical = r.status === "critical_lockdown";
                      return (
                        <tr key={r.id} className={cn("border-b border-border last:border-0 hover:bg-accent/5 transition-colors", isCritical && "bg-red-950/10")}>
                          <td className="px-4 py-3">
                            <span className={cn("font-mono text-xs font-medium", isCritical ? "text-red-400" : "text-primary")}>{r.reportNumber}</span>
                            {r.isDmca && <span className="ml-1 text-[10px] text-indigo-400 font-medium">DMCA</span>}
                          </td>
                          <td className="px-4 py-3"><TypeBadge type={r.abuseType} /></td>
                          <td className="px-4 py-3"><ThreatScoreBadge score={r.threatScore ?? 0} classification={r.classification} /></td>
                          <td className="px-4 py-3">
                            <p className="text-foreground text-xs font-medium truncate max-w-[130px]">{r.reporterName || r.reporterEmail}</p>
                            {r.reporterName && <p className="text-muted-foreground text-xs truncate max-w-[130px]">{r.reporterEmail}</p>}
                            {r.sourceCredibility && <p className="text-[10px] text-primary/70">{r.sourceCredibility}</p>}
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
                            ) : r.dmcaDeadlineAt ? (
                              <span className="text-indigo-400 font-medium text-[10px]">DMCA: {format(new Date(r.dmcaDeadlineAt), "MMM d")}</span>
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
        </>
      )}

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <ShieldAlert className="h-5 w-5 text-red-400" />
              {d?.reportNumber} — Sentinel Report Detail
              {d?.isDmca && <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-xs">⚖️ DMCA</Badge>}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : d ? (
            <div className="space-y-5">
              {/* Status Row */}
              <div className="flex flex-wrap gap-2 items-center">
                <StatusBadge status={d.status} />
                <TypeBadge type={d.abuseType} />
                <ThreatScoreBadge score={d.threatScore ?? 0} classification={d.classification} />
                {d.autoSuspended && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">Auto-Enforced</Badge>}
                {d.isValid === true && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">⚠ Valid Complaint</Badge>}
                {d.isValid === false && <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20 text-xs">Likely False Positive</Badge>}
                {d.isDmca && <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-xs">⚖️ DMCA Takedown</Badge>}
              </div>

              {/* Threat Score Gauge */}
              <div className="bg-background/40 rounded-lg p-4">
                <ScoreGauge score={d.threatScore ?? 0} />
                {d.sourceCredibility && (
                  <p className="text-xs text-muted-foreground mt-2">📡 Source: <span className="text-foreground font-medium">{d.sourceCredibility}</span></p>
                )}
              </div>

              {/* Client Reputation */}
              {d.reputation && (
                <div className={cn("rounded-lg p-4 border", d.reputation.isPermanentlyBanned ? "bg-red-950/20 border-red-700/30" : "bg-background/40 border-border")}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-yellow-400" /> Client Reputation Profile
                    {d.reputation.isPermanentlyBanned && <Badge className="bg-red-700/20 text-red-300 border-red-700/30 text-[10px] ml-auto">PERMANENTLY BANNED</Badge>}
                  </p>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    {[
                      { label: "Total Reports", value: d.reputation.totalReports },
                      { label: "Valid Reports", value: d.reputation.validReports },
                      { label: "Avg Score", value: `${d.reputation.avgThreatScore}/100` },
                      { label: "Max Score", value: `${d.reputation.maxThreatScore}/100` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-background/60 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-bold text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                  {d.reputation.isPermanentlyBanned && d.reputation.banReason && (
                    <p className="text-xs text-red-400 mt-2">Ban reason: {d.reputation.banReason}</p>
                  )}
                </div>
              )}

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
                  ...(d.isDmca ? [
                    { label: "DMCA Deadline", value: d.dmcaDeadlineAt ? format(new Date(d.dmcaDeadlineAt), "PPP") : "—" },
                    { label: "Counter-Notice Filed", value: d.counterNoticeAt ? format(new Date(d.counterNoticeAt), "PPP p") : "None" },
                  ] : []),
                ].map(({ label, value, mono, cap }) => (
                  <div key={label} className="bg-background/40 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className={cn("text-foreground text-sm font-medium break-all", mono && "font-mono text-xs", cap && "capitalize")}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Evidence Logs */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Evidence Logs</p>
                <div className="bg-background/40 border border-border rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap max-h-36 overflow-y-auto font-mono text-xs leading-relaxed">
                  {d.evidenceLogs}
                </div>
              </div>

              {/* Evidence Vault */}
              {(d.evidence?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium flex items-center gap-1"><Database className="h-3.5 w-3.5 text-purple-400" /> Evidence Vault ({d.evidence!.length} items)</p>
                  <div className="space-y-2">
                    {d.evidence!.map(ev => (
                      <div key={ev.id} className="bg-background/40 border border-purple-500/20 rounded-lg p-3 flex items-start gap-3">
                        <Database className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          {ev.fileName && <p className="text-xs font-medium text-foreground">{ev.fileName}</p>}
                          {ev.description && <p className="text-xs text-muted-foreground">{ev.description}</p>}
                          {ev.fileUrl && <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline break-all">{ev.fileUrl}</a>}
                          <p className="text-[10px] text-muted-foreground mt-1">Added {formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true })} by {ev.uploadedBy}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Analysis */}
              {d.analysisNotes && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-xs text-blue-400 font-medium mb-1 flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> Sentinel Analysis</p>
                  <p className="text-xs text-foreground leading-relaxed">{d.analysisNotes}</p>
                </div>
              )}

              {/* DMCA Counter-Notice Info */}
              {d.isDmca && d.counterNoticeText && (
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-3">
                  <p className="text-xs text-indigo-400 font-medium mb-1">⚖️ Counter-Notice Statement</p>
                  <p className="text-xs text-foreground">{d.counterNoticeText}</p>
                  {d.counterNoticeAt && <p className="text-[10px] text-muted-foreground mt-1">Filed {format(new Date(d.counterNoticeAt), "PPP p")}</p>}
                </div>
              )}

              {/* Resolution / Dismissal */}
              {d.resolvedNote && <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3"><p className="text-xs text-green-400 font-medium mb-1">Resolution Note</p><p className="text-sm text-foreground">{d.resolvedNote}</p></div>}
              {d.dismissReason && <div className="bg-gray-500/5 border border-gray-500/20 rounded-lg p-3"><p className="text-xs text-gray-400 font-medium mb-1">Dismissal Reason</p><p className="text-sm text-foreground">{d.dismissReason}</p></div>}

              {/* Timeline */}
              {d.actions && d.actions.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Action Timeline</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {d.actions.map(action => {
                      const cfg = ACTION_LABELS[action.actionType] ?? { label: action.actionType, color: "text-gray-400" };
                      return (
                        <div key={action.id} className="flex gap-3 text-xs">
                          <div className="flex-shrink-0 text-right text-muted-foreground w-24">{format(new Date(action.createdAt), "MMM d HH:mm")}</div>
                          <div className="flex-1">
                            <span className={cn("font-medium", cfg.color)}>{cfg.label}</span>
                            {action.actionNote && <p className="text-muted-foreground mt-0.5 leading-relaxed">{action.actionNote}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              {isActive && (
                <div className="border border-border rounded-lg p-4 space-y-4">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-400" /> Admin Actions</p>

                  <div className="flex flex-wrap gap-2">
                    {/* Analyze */}
                    {["pending", "analyzing"].includes(d.status) && (
                      <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                        disabled={analyzeMut.isPending} onClick={() => analyzeMut.mutate(d.id)}>
                        <Zap className="h-3.5 w-3.5 mr-1" />
                        {analyzeMut.isPending ? "Analyzing..." : "Run Sentinel Analysis"}
                      </Button>
                    )}
                  </div>

                  {/* Link Service */}
                  {!d.serviceId && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Link Hosting Service</Label>
                      <div className="flex gap-2">
                        <Input className="h-8 text-xs bg-background border-border flex-1" placeholder="Search domain..." value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} />
                        <Select value={linkServiceId} onValueChange={setLinkServiceId}>
                          <SelectTrigger className="h-8 text-xs w-44 bg-background border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>{services.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.domain || s.id}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" className="h-8" disabled={!linkServiceId || linkMut.isPending} onClick={() => linkMut.mutate(d.id)}>
                          <Link className="h-3.5 w-3.5 mr-1" /> Link
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Evidence Vault */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Database className="h-3 w-3 text-purple-400" /> Add to Evidence Vault</Label>
                    <div className="flex gap-2">
                      <Input className="h-8 text-xs bg-background border-border flex-1" placeholder="File URL or link..." value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} />
                      <Input className="h-8 text-xs bg-background border-border flex-1" placeholder="Description..." value={evidenceDesc} onChange={e => setEvidenceDesc(e.target.value)} />
                      <Button size="sm" variant="outline" className="h-8 border-purple-500/30 text-purple-400" disabled={(!evidenceUrl && !evidenceDesc) || evidenceMut.isPending} onClick={() => evidenceMut.mutate(d.id)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add
                      </Button>
                    </div>
                  </div>

                  {/* Threat Score Adjustment */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3 text-cyan-400" /> Adjust Threat Score (check reply for resolution keywords)</Label>
                    <div className="flex gap-2">
                      <Input className="h-8 text-xs bg-background border-border flex-1" placeholder="Paste client's ticket reply to detect resolution keywords..." value={ticketReply} onChange={e => setTicketReply(e.target.value)} />
                      <Input type="number" className="h-8 text-xs bg-background border-border w-20" value={scoreAdjust} onChange={e => setScoreAdjust(parseInt(e.target.value) || 0)} />
                      <Button size="sm" variant="outline" className="h-8 border-cyan-500/30 text-cyan-400" disabled={scoreAdjustMut.isPending} onClick={() => scoreAdjustMut.mutate(d.id)}>
                        Adjust
                      </Button>
                    </div>
                  </div>

                  {/* Send Warning */}
                  {["pending", "analyzing"].includes(d.status) && d.clientId && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{d.isDmca ? "⚖️ Send DMCA Notice + Create Dispute Ticket" : "⚠️ Send Warning Email + Create Dispute Ticket"}</Label>
                      <div className="flex gap-2">
                        <Input className="h-8 text-xs bg-background border-border flex-1" placeholder="Optional note..." value={warnNote} onChange={e => setWarnNote(e.target.value)} />
                        <Button size="sm" className={cn("h-8", d.isDmca ? "bg-indigo-600 hover:bg-indigo-700" : "bg-yellow-600 hover:bg-yellow-700", "text-white")}
                          disabled={warnMut.isPending} onClick={() => warnMut.mutate(d.id)}>
                          <Mail className="h-3.5 w-3.5 mr-1" />
                          {warnMut.isPending ? "Sending..." : d.isDmca ? "Send DMCA Notice" : "Send Warning Email"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* DMCA Counter-Notice (admin review) */}
                  {d.isDmca && d.counterNoticeText && !d.counterNoticeAt?.includes("accepted") && (
                    <div className="space-y-1.5 bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-3">
                      <Label className="text-xs text-indigo-400 font-medium">⚖️ Process Counter-Notice</Label>
                      <Textarea className="h-20 text-xs bg-background border-border" placeholder="Admin review notes..." value={counterNoticeText} onChange={e => setCounterNoticeText(e.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8" onClick={() => counterNoticeMut.mutate({ id: d.id, accept: true })}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Accept — Resolve Case
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 h-8" onClick={() => counterNoticeMut.mutate({ id: d.id, accept: false })}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Reject Counter-Notice
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Suspend */}
                  {["pending", "analyzing", "warning_sent"].includes(d.status) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        {(d.threatScore ?? 0) >= 90 ? "🔴 Critical Lockdown (Score ≥ 90)" : "Suspend Service"}
                      </Label>
                      <div className="flex gap-2">
                        <Input className="h-8 text-xs bg-background border-border flex-1" placeholder="Suspension reason..." value={suspendReason} onChange={e => setSuspendReason(e.target.value)} />
                        <Button size="sm" className={cn("h-8 text-white", (d.threatScore ?? 0) >= 90 ? "bg-red-800 hover:bg-red-900" : "bg-red-600 hover:bg-red-700")}
                          disabled={suspendMut.isPending} onClick={() => suspendMut.mutate(d.id)}>
                          <Skull className="h-3.5 w-3.5 mr-1" />
                          {suspendMut.isPending ? "Processing..." : (d.threatScore ?? 0) >= 90 ? "Critical Lockdown" : "Suspend Service"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Resolve */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Resolution Note</Label>
                    <div className="flex gap-2">
                      <Input className="h-8 text-xs bg-background border-border flex-1" placeholder="e.g. Client resolved the issue..." value={resolveNote} onChange={e => setResolveNote(e.target.value)} />
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8" disabled={resolveMut.isPending} onClick={() => resolveMut.mutate(d.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        {resolveMut.isPending ? "Resolving..." : "Resolve & Unsuspend"}
                      </Button>
                    </div>
                  </div>

                  {/* Dismiss */}
                  {["pending", "analyzing"].includes(d.status) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Dismiss Reason</Label>
                      <div className="flex gap-2">
                        <Input className="h-8 text-xs bg-background border-border flex-1" placeholder="e.g. False positive — verified opt-in list" value={dismissReason} onChange={e => setDismissReason(e.target.value)} />
                        <Button size="sm" variant="outline" className="border-gray-500/30 text-gray-400 hover:bg-gray-500/10 h-8" disabled={dismissMut.isPending} onClick={() => dismissMut.mutate(d.id)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          {dismissMut.isPending ? "Dismissing..." : "Dismiss"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
