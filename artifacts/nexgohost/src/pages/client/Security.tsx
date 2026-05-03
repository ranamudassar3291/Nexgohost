import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, QrCode, CheckCircle, Loader2, Lock, Unlock, AlertTriangle,
  Copy, Eye, EyeOff, KeyRound, Activity, Monitor, Smartphone,
  CheckCircle2, XCircle, ShieldCheck, ShieldAlert, ShieldOff,
  Wifi, TrendingUp, Users, BarChart2, Globe, Zap, RefreshCw,
  AlertCircle, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "security" | "analytics" | "activity";
type Step2FA = "idle" | "scanning" | "verifying" | "done";

interface BreakdownItem {
  key: string; label: string; passed: boolean;
  points: number; maxPoints: number; description: string;
}
interface HealthScore {
  score: number; breakdown: BreakdownItem[];
  detectedIp: string; isBlocked: boolean;
}
interface VisitorDay { date: string; visitors: number; pageViews: number; }
interface VisitorStats {
  days: VisitorDay[];
  summary: { totalVisitors: number; totalPageViews: number; avgDailyVisitors: number; peakVisitors: number; peakDate: string; bounceRate: number; };
}
interface ActivityLog {
  id: string; action: string; ip: string | null;
  userAgent: string | null; status: string; note: string | null; createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function detectDevice(ua: string | null) {
  if (!ua) return "desktop";
  return /android|iphone|ipad|mobile/i.test(ua) ? "mobile" : "desktop";
}

function scoreColor(score: number) {
  if (score >= 80) return { stroke: "#22c55e", text: "text-green-500", label: "Excellent" };
  if (score >= 60) return { stroke: "#f59e0b", text: "text-amber-500", label: "Good" };
  if (score >= 40) return { stroke: "#f97316", text: "text-orange-500", label: "Fair" };
  return { stroke: "#ef4444", text: "text-red-500", label: "At Risk" };
}

// ─── Health Score Gauge ───────────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const { stroke, text, label } = scoreColor(score);
  const r = 52; const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-border/40" />
          <motion.circle
            cx="60" cy="60" r={r} fill="none"
            stroke={stroke} strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-black ${text}`}>{score}</span>
          <span className="text-xs text-muted-foreground font-medium">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-bold ${text}`}>{label}</span>
    </div>
  );
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────
function VisitorChart({ days, metric }: { days: VisitorDay[]; metric: "visitors" | "pageViews" }) {
  const values = days.map(d => d[metric]);
  const max = Math.max(...values, 1);
  const W = 600; const H = 160; const PL = 8; const PR = 8; const PT = 12; const PB = 28;
  const iW = W - PL - PR; const iH = H - PT - PB;
  const xs = days.map((_, i) => PL + (i / (days.length - 1)) * iW);
  const ys = values.map(v => PT + iH - (v / max) * iH);
  const pathD = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${ys[i]}`).join(" ");
  const areaD = `${pathD} L ${xs[xs.length - 1]} ${PT + iH} L ${xs[0]} ${PT + iH} Z`;
  const c1 = metric === "visitors" ? "#6366f1" : "#06b6d4";
  const c2 = metric === "visitors" ? "#6366f133" : "#06b6d433";

  const labelIdxs = [0, 7, 14, 21, 29];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c1} stopOpacity="0.3" />
          <stop offset="100%" stopColor={c1} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(f => {
        const y = PT + iH * (1 - f);
        return <line key={f} x1={PL} y1={y} x2={W - PR} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />;
      })}
      <path d={areaD} fill={`url(#grad-${metric})`} />
      <path d={pathD} fill="none" stroke={c1} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {labelIdxs.map(i => (
        <text key={i} x={xs[i]} y={H - 4} textAnchor="middle" fontSize="11" fill="#94a3b8">
          {days[i]?.date.slice(5)}
        </text>
      ))}
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r="0" fill={c1}>
          <title>{days[i].date}: {values[i].toLocaleString()}</title>
        </circle>
      ))}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function Security() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("security");
  const [chartMetric, setChartMetric] = useState<"visitors" | "pageViews">("visitors");

  // 2FA state
  const [step, setStep] = useState<Step2FA>("idle");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [totp, setTotp] = useState("");
  const [disableTotp, setDisableTotp] = useState("");
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [loading2FA, setLoading2FA] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: user } = useQuery<{ twoFactorEnabled: boolean; email: string; firstName: string }>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/auth/me"),
  });

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery<HealthScore>({
    queryKey: ["my-health-score"],
    queryFn: () => apiFetch("/api/my/security/health-score"),
    staleTime: 30000,
  });

  const { data: visitorData, isLoading: visitorLoading } = useQuery<VisitorStats>({
    queryKey: ["my-visitor-stats"],
    queryFn: () => apiFetch("/api/my/security/visitor-stats"),
    enabled: tab === "analytics",
    staleTime: 300000,
  });

  const { data: activityLogs = [], isLoading: actLoading } = useQuery<ActivityLog[]>({
    queryKey: ["activity-logs"],
    queryFn: () => apiFetch("/api/my/activity"),
    staleTime: 60000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const unblockMutation = useMutation({
    mutationFn: () => apiFetch("/api/my/security/unblock-ip", { method: "POST" }),
    onSuccess: (data) => {
      toast({ title: "IP Unblocked", description: data.message });
      qc.invalidateQueries({ queryKey: ["my-health-score"] });
      refetchHealth();
    },
    onError: (err: any) => toast({ title: "Unblock failed", description: err.message, variant: "destructive" }),
  });

  // ── 2FA handlers ──────────────────────────────────────────────────────────
  async function handleSetup() {
    setLoading2FA(true);
    try {
      const data = await apiFetch("/api/auth/2fa/setup");
      setQrCode(data.qrCode); setSecret(data.secret); setStep("scanning");
    } catch (err: any) { toast({ title: "Setup failed", description: err.message, variant: "destructive" }); }
    finally { setLoading2FA(false); }
  }

  async function handleEnable() {
    if (totp.length !== 6) { toast({ title: "Enter 6-digit code", variant: "destructive" }); return; }
    setLoading2FA(true);
    try {
      await apiFetch("/api/auth/2fa/enable", { method: "POST", body: JSON.stringify({ totp }) });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["my-health-score"] });
      setStep("done");
      toast({ title: "2FA Enabled", description: "Your account is now protected." });
    } catch (err: any) { toast({ title: "Verification failed", description: err.message, variant: "destructive" }); }
    finally { setLoading2FA(false); }
  }

  async function handleDisable() {
    if (disableTotp.length !== 6) { toast({ title: "Enter 6-digit code", variant: "destructive" }); return; }
    setLoading2FA(true);
    try {
      await apiFetch("/api/auth/2fa/disable", { method: "POST", body: JSON.stringify({ totp: disableTotp }) });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["my-health-score"] });
      setShowDisableConfirm(false); setDisableTotp("");
      toast({ title: "2FA Disabled" });
    } catch (err: any) { toast({ title: "Disable failed", description: err.message, variant: "destructive" }); }
    finally { setLoading2FA(false); }
  }

  const is2FAEnabled = user?.twoFactorEnabled ?? false;
  const { stroke: scoreStroke, text: scoreText } = scoreColor(healthData?.score ?? 0);

  // ── Stats summary ──────────────────────────────────────────────────────────
  const summary = visitorData?.summary;
  const days = visitorData?.days ?? [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck size={24} className="text-primary" /> Security & Analytics
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Monitor your account health, traffic, and activity.</p>
        </div>
        <button
          onClick={() => refetchHealth()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 transition-all"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-secondary/50 border border-border/60 rounded-xl p-1">
        {([
          { id: "security", label: "Security Center", icon: Shield },
          { id: "analytics", label: "Analytics",      icon: BarChart2 },
          { id: "activity",  label: "Activity Log",   icon: Activity },
        ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? "bg-card shadow-sm text-foreground border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ══════════════ SECURITY CENTER ══════════════ */}
        {tab === "security" && (
          <motion.div key="security" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">

            {/* Health Score Card */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-border/60">
                <p className="font-semibold text-foreground">Website Health Score</p>
                <p className="text-xs text-muted-foreground mt-0.5">Calculated from 5 security and billing checks.</p>
              </div>
              <div className="p-6">
                {healthLoading ? (
                  <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin text-primary" /></div>
                ) : healthData ? (
                  <div className="flex flex-col sm:flex-row items-center gap-8">
                    <ScoreGauge score={healthData.score} />
                    <div className="flex-1 w-full space-y-2.5">
                      {healthData.breakdown.map(item => (
                        <div key={item.key} className="flex items-start gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${item.passed ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                            {item.passed
                              ? <CheckCircle2 size={13} className="text-green-500" />
                              : <AlertCircle size={13} className="text-red-400" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-foreground">{item.label}</span>
                              <span className={`text-xs font-bold shrink-0 ${item.passed ? "text-green-500" : "text-red-400"}`}>
                                +{item.points}/{item.maxPoints}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* IP Unblocker Card */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-border/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                  <Wifi size={18} className="text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">IP Unblocker</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Instantly remove your IP from our server firewall.</p>
                </div>
              </div>
              <div className="p-5">
                {healthLoading ? (
                  <div className="h-14 flex items-center"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">Your detected IP address</p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground bg-secondary/60 border border-border px-3 py-1.5 rounded-lg tracking-wider">
                          {healthData?.detectedIp ?? "—"}
                        </span>
                        {healthData?.isBlocked ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-full">
                            <ShieldAlert size={11} /> Blocked
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-full">
                            <ShieldCheck size={11} /> Clear
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => unblockMutation.mutate()}
                      disabled={unblockMutation.isPending}
                      className="gap-2 bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 shrink-0"
                    >
                      {unblockMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                      Unblock My IP
                    </Button>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-3 flex items-start gap-1.5">
                  <AlertTriangle size={11} className="shrink-0 mt-0.5 text-amber-400" />
                  This will remove your IP from the platform firewall and whitelist it. If you are still blocked by your host's firewall (cPanel/CSF), contact support.
                </p>
              </div>
            </div>

            {/* 2FA Card */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-border/60">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${is2FAEnabled ? "bg-green-500/10 border border-green-500/20" : "bg-secondary/60 border border-border"}`}>
                      {is2FAEnabled ? <Lock size={18} className="text-green-500" /> : <Unlock size={18} className="text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Two-Factor Authentication</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Extra login security via authenticator app.</p>
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${is2FAEnabled ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-secondary text-muted-foreground border-border"}`}>
                    {is2FAEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <AnimatePresence mode="wait">
                  {is2FAEnabled && !showDisableConfirm && (
                    <motion.div key="en" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                        <CheckCircle size={16} className="text-green-500 shrink-0" />
                        <p className="text-sm text-foreground">2FA is active — each login requires your authenticator code.</p>
                      </div>
                      <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/5 hover:text-red-400 text-sm" onClick={() => setShowDisableConfirm(true)}>
                        <Unlock size={13} className="mr-1.5" /> Disable 2FA
                      </Button>
                    </motion.div>
                  )}
                  {is2FAEnabled && showDisableConfirm && (
                    <motion.div key="dis" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-foreground">Enter your current 6-digit code to confirm disabling 2FA.</p>
                      </div>
                      <Input value={disableTotp} onChange={e => setDisableTotp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} className="text-center tracking-[0.4em] font-mono text-lg w-36" autoFocus />
                      <div className="flex gap-2">
                        <Button onClick={handleDisable} disabled={loading2FA || disableTotp.length !== 6} variant="destructive" size="sm" className="gap-1.5">
                          {loading2FA ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />} Disable 2FA
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setShowDisableConfirm(false); setDisableTotp(""); }}>Cancel</Button>
                      </div>
                    </motion.div>
                  )}
                  {!is2FAEnabled && step === "idle" && (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                      <p className="text-sm text-muted-foreground">Protect your account with Google Authenticator, Authy, or any TOTP app.</p>
                      <Button onClick={handleSetup} disabled={loading2FA} className="gap-2 bg-primary hover:bg-primary/90 text-sm">
                        {loading2FA ? <Loader2 size={13} className="animate-spin" /> : <QrCode size={13} />} Set Up 2FA
                      </Button>
                    </motion.div>
                  )}
                  {!is2FAEnabled && step === "scanning" && (
                    <motion.div key="scan" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                      <p className="text-sm font-semibold text-foreground">Step 1 — Scan this QR Code in your authenticator app</p>
                      {qrCode && (
                        <div className="flex flex-col sm:flex-row items-center gap-5">
                          <div className="w-40 h-40 rounded-2xl overflow-hidden border-4 border-primary/20 bg-white p-2 shrink-0">
                            <img src={qrCode} alt="2FA QR Code" className="w-full h-full" />
                          </div>
                          <div className="space-y-2 w-full">
                            <p className="text-xs text-muted-foreground">Or enter this key manually:</p>
                            <div className="flex items-center gap-2 bg-secondary/60 border border-border rounded-xl px-3 py-2">
                              <code className="text-xs font-mono text-foreground flex-1 tracking-widest select-all">{showSecret ? secret : secret.replace(/./g, "•")}</code>
                              <button onClick={() => setShowSecret(s => !s)} className="text-muted-foreground hover:text-foreground transition-colors">{showSecret ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                              <button onClick={() => { navigator.clipboard.writeText(secret); toast({ title: "Secret copied" }); }} className="text-muted-foreground hover:text-primary transition-colors"><Copy size={13} /></button>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-foreground">Step 2 — Enter the 6-digit code</p>
                        <Input value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} className="text-center tracking-[0.4em] font-mono text-lg w-36" autoFocus />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleEnable} disabled={loading2FA || totp.length !== 6} className="gap-1.5 bg-primary hover:bg-primary/90 text-sm">
                          {loading2FA ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Activate 2FA
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setStep("idle"); setTotp(""); setQrCode(""); setSecret(""); }}>Cancel</Button>
                      </div>
                    </motion.div>
                  )}
                  {step === "done" && (
                    <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-3 py-4">
                      <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                        <CheckCircle size={28} className="text-green-400" />
                      </div>
                      <p className="text-base font-bold text-foreground">2FA Activated!</p>
                      <p className="text-sm text-muted-foreground">Your account is now protected.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Password card */}
            <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/60 border border-border flex items-center justify-center shrink-0">
                <KeyRound size={18} className="text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">Password</p>
                <p className="text-xs text-muted-foreground mt-0.5">Change your password in Account settings.</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </div>
          </motion.div>
        )}

        {/* ══════════════ ANALYTICS ══════════════ */}
        {tab === "analytics" && (
          <motion.div key="analytics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">

            {/* Stat Cards */}
            {visitorLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
            ) : summary ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Total Visitors",    value: summary.totalVisitors.toLocaleString(),    icon: Users,      color: "text-indigo-500",  bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
                    { label: "Total Page Views",   value: summary.totalPageViews.toLocaleString(),   icon: Globe,      color: "text-cyan-500",    bg: "bg-cyan-500/10",   border: "border-cyan-500/20" },
                    { label: "Avg Daily Visitors", value: summary.avgDailyVisitors.toLocaleString(), icon: TrendingUp, color: "text-green-500",   bg: "bg-green-500/10",  border: "border-green-500/20" },
                    { label: "Peak Day Visitors",  value: summary.peakVisitors.toLocaleString(),     icon: Zap,        color: "text-amber-500",   bg: "bg-amber-500/10",  border: "border-amber-500/20" },
                    { label: "Bounce Rate",        value: `${summary.bounceRate}%`,                  icon: Activity,   color: "text-rose-500",    bg: "bg-rose-500/10",   border: "border-rose-500/20" },
                    { label: "Peak Date",          value: summary.peakDate,                          icon: BarChart2,  color: "text-primary",     bg: "bg-primary/10",    border: "border-primary/20" },
                  ].map(({ label, value, icon: Icon, color, bg, border }) => (
                    <div key={label} className="bg-card border border-border rounded-xl p-4 space-y-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg} border ${border}`}>
                        <Icon size={15} className={color} />
                      </div>
                      <div>
                        <p className={`text-xl font-black ${color}`}>{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-border/60 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">30-Day Traffic</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Unique visitors and page views over the last month.</p>
                    </div>
                    <div className="flex gap-1 bg-secondary/60 border border-border rounded-lg p-1">
                      {([
                        { id: "visitors", label: "Visitors" },
                        { id: "pageViews", label: "Page Views" },
                      ] as { id: "visitors" | "pageViews"; label: string }[]).map(({ id, label }) => (
                        <button
                          key={id}
                          onClick={() => setChartMetric(id)}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${chartMetric === id ? "bg-card shadow-sm text-foreground border border-border/60" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-5">
                    <VisitorChart days={days} metric={chartMetric} />
                    <div className="flex items-center justify-end gap-3 mt-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-indigo-500 rounded" />
                        <span className="text-xs text-muted-foreground">Unique Visitors</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-cyan-500 rounded" />
                        <span className="text-xs text-muted-foreground">Page Views</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </motion.div>
        )}

        {/* ══════════════ ACTIVITY LOG ══════════════ */}
        {tab === "activity" && (
          <motion.div key="activity" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-border/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/60 border border-border flex items-center justify-center shrink-0">
                  <Activity size={18} className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Recent Actions</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your last 50 account events — logins, changes, payments.</p>
                </div>
              </div>

              {actLoading ? (
                <div className="flex justify-center p-10"><Loader2 size={22} className="animate-spin text-primary" /></div>
              ) : activityLogs.length === 0 ? (
                <div className="p-10 text-center">
                  <Activity size={28} className="mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No recent activity found.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[38px] top-0 bottom-0 w-px bg-border/50" />
                  <div className="divide-y divide-border/40">
                    {activityLogs.map((log, idx) => {
                      const isSuccess = log.status === "success";
                      const device = detectDevice(log.userAgent);
                      const actionLabel = log.action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                      return (
                        <div key={log.id} className="flex items-start gap-3 px-5 py-4">
                          <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isSuccess ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                            {isSuccess
                              ? <CheckCircle2 size={14} className="text-green-500" />
                              : <XCircle size={14} className="text-red-400" />
                            }
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">{actionLabel}</p>
                              <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                                {format(new Date(log.createdAt), "MMM d, yyyy · HH:mm")}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              {log.ip && (
                                <span className="text-[11px] text-muted-foreground font-mono bg-secondary/60 px-1.5 py-0.5 rounded">
                                  {log.ip}
                                </span>
                              )}
                              {log.userAgent && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  {device === "mobile" ? <Smartphone size={10} /> : <Monitor size={10} />}
                                  {device === "mobile" ? "Mobile" : "Desktop"}
                                </span>
                              )}
                              {!isSuccess && (
                                <span className="text-[11px] font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Failed</span>
                              )}
                              {log.note && <span className="text-[11px] text-muted-foreground">· {log.note}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
