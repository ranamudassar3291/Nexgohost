import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, QrCode, CheckCircle, Loader2, Lock, Unlock, AlertTriangle, Copy, Eye, EyeOff, KeyRound, Activity, Monitor, Smartphone, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

type Step2FA = "idle" | "scanning" | "verifying" | "done";

interface ActivityLog {
  id: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  status: string;
  note: string | null;
  createdAt: string;
}

function detectDevice(ua: string | null): "mobile" | "desktop" {
  if (!ua) return "desktop";
  return /android|iphone|ipad|mobile/i.test(ua) ? "mobile" : "desktop";
}

export default function Security() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: user, isLoading } = useQuery<{ twoFactorEnabled: boolean; email: string; firstName: string }>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/auth/me"),
  });

  const { data: activityLogs = [], isLoading: actLoading } = useQuery<ActivityLog[]>({
    queryKey: ["activity-logs"],
    queryFn: () => apiFetch("/api/my/activity"),
    staleTime: 60000,
  });

  const [step, setStep] = useState<Step2FA>("idle");
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [totp, setTotp] = useState("");
  const [disableTotp, setDisableTotp] = useState("");
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const is2FAEnabled = user?.twoFactorEnabled ?? false;

  async function handleSetup() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/2fa/setup");
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("scanning");
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleEnable() {
    if (totp.length !== 6) { toast({ title: "Enter 6-digit code", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await apiFetch("/api/auth/2fa/enable", { method: "POST", body: JSON.stringify({ totp }) });
      qc.invalidateQueries({ queryKey: ["me"] });
      setStep("done");
      toast({ title: "2FA Enabled", description: "Your account is now protected with two-factor authentication." });
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleDisable() {
    if (disableTotp.length !== 6) { toast({ title: "Enter 6-digit code", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await apiFetch("/api/auth/2fa/disable", { method: "POST", body: JSON.stringify({ totp: disableTotp }) });
      qc.invalidateQueries({ queryKey: ["me"] });
      setShowDisableConfirm(false);
      setDisableTotp("");
      toast({ title: "2FA Disabled", description: "Two-factor authentication has been removed from your account." });
    } catch (err: any) {
      toast({ title: "Disable failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    toast({ title: "Secret copied to clipboard" });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield size={24} className="text-primary" /> Security Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage your account security and authentication preferences.</p>
      </div>

      {/* 2FA Card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/5">
        <div className="p-6 border-b border-border/60">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${is2FAEnabled ? "bg-green-500/15 border border-green-500/20" : "bg-secondary/60 border border-border"}`}>
                {is2FAEnabled ? <Lock size={20} className="text-green-500" /> : <Unlock size={20} className="text-muted-foreground" />}
              </div>
              <div>
                <p className="font-semibold text-foreground">Two-Factor Authentication (2FA)</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Add an extra layer of security using Google Authenticator or any TOTP app.
                </p>
              </div>
            </div>
            <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${is2FAEnabled ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-secondary text-muted-foreground border-border"}`}>
              {is2FAEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {/* === 2FA ENABLED STATE === */}
            {is2FAEnabled && !showDisableConfirm && (
              <motion.div key="enabled" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                  <CheckCircle size={20} className="text-green-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">2FA is active on your account</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Each login requires your authenticator app code.</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/5 hover:text-red-400"
                  onClick={() => setShowDisableConfirm(true)}
                >
                  <Unlock size={15} className="mr-2" /> Disable 2FA
                </Button>
              </motion.div>
            )}

            {/* === DISABLE CONFIRM === */}
            {is2FAEnabled && showDisableConfirm && (
              <motion.div key="disable-confirm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                  <AlertTriangle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Confirm Disable 2FA</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Enter your current 6-digit authenticator code to confirm.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/70">Authenticator Code</label>
                  <Input
                    value={disableTotp}
                    onChange={e => setDisableTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="text-center tracking-[0.4em] font-mono text-lg w-40"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleDisable}
                    disabled={loading || disableTotp.length !== 6}
                    variant="destructive"
                    className="gap-2"
                  >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <Unlock size={15} />}
                    Disable 2FA
                  </Button>
                  <Button variant="outline" onClick={() => { setShowDisableConfirm(false); setDisableTotp(""); }}>
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}

            {/* === NOT ENABLED — IDLE === */}
            {!is2FAEnabled && step === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="text-sm text-muted-foreground space-y-1.5">
                  <p>With 2FA enabled, you'll need your authenticator app code in addition to your password when logging in.</p>
                  <p>Compatible apps: <span className="text-foreground font-medium">Google Authenticator, Authy, 1Password, Bitwarden</span></p>
                </div>
                <Button onClick={handleSetup} disabled={loading} className="gap-2 bg-primary hover:bg-primary/90">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
                  Set Up 2FA
                </Button>
              </motion.div>
            )}

            {/* === SCANNING QR CODE === */}
            {!is2FAEnabled && step === "scanning" && (
              <motion.div key="scanning" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">Step 1 — Scan the QR Code</p>
                  <p className="text-xs text-muted-foreground">Open your authenticator app and scan this QR code.</p>
                </div>

                {qrCode && (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-48 h-48 rounded-2xl overflow-hidden border-4 border-primary/20 bg-white p-2">
                      <img src={qrCode} alt="2FA QR Code" className="w-full h-full" />
                    </div>
                    <div className="text-center space-y-2 w-full">
                      <p className="text-xs text-muted-foreground">Or enter this key manually:</p>
                      <div className="flex items-center gap-2 bg-secondary/60 border border-border rounded-xl px-3 py-2">
                        <code className="text-xs font-mono text-foreground flex-1 tracking-widest select-all">
                          {showSecret ? secret : secret.replace(/./g, "•")}
                        </code>
                        <button onClick={() => setShowSecret(s => !s)} className="text-muted-foreground hover:text-foreground transition-colors">
                          {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button onClick={copySecret} className="text-muted-foreground hover:text-primary transition-colors">
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">Step 2 — Verify the Code</p>
                  <p className="text-xs text-muted-foreground">Enter the 6-digit code from your authenticator app to activate 2FA.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/70">6-Digit Code</label>
                  <Input
                    value={totp}
                    onChange={e => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="text-center tracking-[0.4em] font-mono text-lg w-40"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleEnable} disabled={loading || totp.length !== 6} className="gap-2 bg-primary hover:bg-primary/90">
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                    Activate 2FA
                  </Button>
                  <Button variant="outline" onClick={() => { setStep("idle"); setTotp(""); setQrCode(""); setSecret(""); }}>
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}

            {/* === SUCCESS === */}
            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4 py-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle size={32} className="text-green-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">2FA Activated!</p>
                  <p className="text-sm text-muted-foreground mt-1">Your account is now protected with two-factor authentication.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Password Change info card */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-secondary/60 border border-border flex items-center justify-center">
            <KeyRound size={20} className="text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Password</p>
            <p className="text-sm text-muted-foreground">Change your account password in the Account settings page.</p>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/60 border border-border flex items-center justify-center shrink-0">
            <Activity size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Recent Activity</p>
            <p className="text-sm text-muted-foreground">Your last 20 account actions and login events.</p>
          </div>
        </div>
        <div className="divide-y divide-border/40">
          {actLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No recent activity found.</div>
          ) : (
            activityLogs.map(log => {
              const isSuccess = log.status === "success";
              const device = detectDevice(log.userAgent);
              return (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isSuccess ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                    {isSuccess
                      ? <CheckCircle2 size={14} className="text-green-400" />
                      : <XCircle size={14} className="text-red-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground capitalize">{log.action.replace(/_/g, " ")}</p>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {format(new Date(log.createdAt), "MMM d, HH:mm")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {log.ip && <span className="text-[11px] text-muted-foreground font-mono">{log.ip}</span>}
                      {log.userAgent && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          {device === "mobile" ? <Smartphone size={10} /> : <Monitor size={10} />}
                          {device === "mobile" ? "Mobile" : "Desktop"}
                        </span>
                      )}
                      {log.note && <span className="text-[11px] text-muted-foreground">· {log.note}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
