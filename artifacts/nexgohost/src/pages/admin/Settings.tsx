import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, Bell, Shield, Globe, Mail, Smartphone, CheckCircle, Loader2, QrCode, Eye, EyeOff, ChevronRight, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

interface Me { twoFactorEnabled: boolean; emailVerified: boolean; email: string; }
interface PlatformSettings { email_verification_enabled: boolean; }

export default function AdminSettings() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  // ── Email Verification ────────────────────────────────────────────────────
  const [savingVerification, setSavingVerification] = useState(false);

  const { data: platformSettings, refetch: refetchPlatformSettings } = useQuery<PlatformSettings>({
    queryKey: ["platform-settings"],
    queryFn: () => apiFetch("/api/admin/settings"),
  });

  const emailVerificationEnabled = platformSettings?.email_verification_enabled ?? true;

  const handleVerificationToggle = async (enabled: boolean) => {
    setSavingVerification(true);
    try {
      await apiFetch("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ email_verification_enabled: enabled }),
      });
      await refetchPlatformSettings();
      qc.invalidateQueries({ queryKey: ["platform-settings"] });
      toast({
        title: enabled ? "Email verification enabled" : "Email verification disabled",
        description: enabled
          ? "New client registrations will require email OTP verification."
          : "New clients can sign in immediately after registration.",
      });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally { setSavingVerification(false); }
  };

  // ── 2FA ──────────────────────────────────────────────────────────────────
  const [twoFAStep, setTwoFAStep] = useState<"idle" | "setup" | "verify" | "enabled">("idle");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [totpInput, setTotpInput] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading2FA, setLoading2FA] = useState(false);

  const { data: me, refetch: refetchMe } = useQuery<Me>({
    queryKey: ["auth-me"],
    queryFn: () => apiFetch("/api/auth/me"),
  });

  // ── 2FA handlers ─────────────────────────────────────────────────────────
  const handle2FASetup = async () => {
    setLoading2FA(true);
    try {
      const data = await apiFetch("/api/auth/2fa/setup");
      setQrCode(data.qrCode); setSecret(data.secret); setTwoFAStep("setup");
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setLoading2FA(false); }
  };

  const handle2FAEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading2FA(true);
    try {
      await apiFetch("/api/auth/2fa/enable", { method: "POST", body: JSON.stringify({ totp: totpInput }) });
      toast({ title: "2FA enabled", description: "Your account is now protected with Google Authenticator." });
      setTwoFAStep("enabled"); refetchMe();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setLoading2FA(false); }
  };

  const handle2FADisable = async () => {
    if (!confirm("Are you sure you want to disable 2FA? This will reduce your account security.")) return;
    setLoading2FA(true);
    try {
      await apiFetch("/api/auth/2fa/disable", { method: "POST" });
      toast({ title: "2FA disabled" });
      setTwoFAStep("idle"); setQrCode(""); setSecret(""); setTotpInput(""); refetchMe();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setLoading2FA(false); }
  };

  const is2FAEnabled = me?.twoFactorEnabled;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground mt-1">Platform configuration and preferences</p>
      </div>

      <div className="bg-card border border-border rounded-2xl divide-y divide-border">

        {/* Company Settings */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg"><Globe className="w-5 h-5 text-primary" /></div>
            <h3 className="font-semibold text-foreground">Company Settings</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><label className="text-sm text-muted-foreground">Company Name</label><Input defaultValue="Noehost" className="bg-background border-border" /></div>
            <div className="space-y-1"><label className="text-sm text-muted-foreground">Support Email</label><Input defaultValue="support@noehost.com" className="bg-background border-border" /></div>
            <div className="space-y-1"><label className="text-sm text-muted-foreground">Company URL</label><Input defaultValue="https://noehost.com" className="bg-background border-border" /></div>
            <div className="space-y-1"><label className="text-sm text-muted-foreground">Phone Number</label><Input defaultValue="+1-555-0100" className="bg-background border-border" /></div>
          </div>
          <Button className="mt-4">Save Changes</Button>
        </div>

        {/* Email Configuration — link to dedicated page */}
        <div className="p-6">
          <button onClick={() => setLocation("/admin/settings/email")}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group text-left">
            <div className="p-2.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
              <Mail className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">Email Configuration</p>
              <p className="text-xs text-muted-foreground mt-0.5">Configure SMTP, test connections, view delivery logs</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          </button>
        </div>

        {/* Email Notifications */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg"><Bell className="w-5 h-5 text-purple-400" /></div>
            <h3 className="font-semibold text-foreground">Email Notifications</h3>
          </div>
          <div className="space-y-4">
            {[
              { label: "New Order Notifications", desc: "Get notified when a new order is placed" },
              { label: "New Ticket Notifications", desc: "Get notified when a support ticket is opened" },
              { label: "Payment Received", desc: "Get notified when a payment is received" },
              { label: "Migration Requests", desc: "Get notified for new migration requests" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch defaultChecked />
              </div>
            ))}
          </div>
        </div>

        {/* 2FA Security */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-green-500/10 rounded-lg"><Shield className="w-5 h-5 text-green-400" /></div>
            <div>
              <h3 className="font-semibold text-foreground">Two-Factor Authentication</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Add an extra layer of security with Google Authenticator</p>
            </div>
            {is2FAEnabled && (
              <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1">
                <CheckCircle size={12} /> Enabled
              </span>
            )}
          </div>

          {is2FAEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                <Smartphone size={20} className="text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Google Authenticator is active</p>
                  <p className="text-xs text-muted-foreground">Your account requires a 6-digit code on every login</p>
                </div>
              </div>
              <Button variant="outline" onClick={handle2FADisable} disabled={loading2FA} className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5">
                {loading2FA ? <Loader2 size={15} className="animate-spin mr-2" /> : null}
                Disable 2FA
              </Button>
            </div>
          ) : twoFAStep === "idle" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Protect your account by enabling two-factor authentication using Google Authenticator or any TOTP app.</p>
              <Button onClick={handle2FASetup} disabled={loading2FA} className="gap-2 bg-primary">
                {loading2FA ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
                Set Up Google Authenticator
              </Button>
            </div>
          ) : twoFAStep === "setup" ? (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                {qrCode && <img src={qrCode} alt="QR Code" className="w-40 h-40 rounded-xl border border-border bg-white p-1 shrink-0" />}
                <div className="space-y-3">
                  <p className="text-sm text-foreground font-medium">Step 1: Scan QR Code</p>
                  <p className="text-sm text-muted-foreground">Open Google Authenticator (or any TOTP app) and scan the QR code, or enter the secret key manually.</p>
                  <div className="bg-secondary/50 border border-border rounded-lg px-3 py-2 flex items-center gap-2">
                    <code className="text-xs font-mono text-foreground/80 flex-1 break-all">{showSecret ? secret : "•".repeat(secret.length)}</code>
                    <button onClick={() => setShowSecret(s => !s)} className="text-muted-foreground hover:text-foreground">
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
              <form onSubmit={handle2FAEnable} className="space-y-3">
                <p className="text-sm text-foreground font-medium">Step 2: Enter the 6-digit code</p>
                <Input value={totpInput} onChange={e => setTotpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" maxLength={6}
                  className="w-40 text-center font-mono text-xl tracking-[0.4em] bg-background" />
                <div className="flex gap-2">
                  <Button type="submit" disabled={loading2FA || totpInput.length !== 6} className="bg-primary gap-2">
                    {loading2FA ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Verify & Enable 2FA
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setTwoFAStep("idle"); setTotpInput(""); }}>Cancel</Button>
                </div>
              </form>
            </div>
          ) : null}
        </div>

        {/* Email Verification (OTP) */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-blue-500/10 rounded-lg"><MailCheck className="w-5 h-5 text-blue-400" /></div>
            <div>
              <h3 className="font-semibold text-foreground">Email Verification</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Require clients to verify their email address via OTP before signing in</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-background/50 border border-border">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Enable Email Verification / OTP</p>
              <p className="text-xs text-muted-foreground mt-1">
                {emailVerificationEnabled
                  ? "ON — New clients must verify their email with a 6-digit code before they can log in."
                  : "OFF — New clients are activated immediately without email verification."}
              </p>
            </div>
            <div className="flex items-center gap-3 ml-4">
              {savingVerification && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
              <Switch
                checked={emailVerificationEnabled}
                onCheckedChange={handleVerificationToggle}
                disabled={savingVerification}
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl border text-xs space-y-1 ${emailVerificationEnabled ? "border-blue-500/20 bg-blue-500/5" : "border-border bg-background/30 opacity-50"}`}>
              <p className="font-medium text-foreground">When ON</p>
              <p className="text-muted-foreground">• 6-digit OTP generated at registration</p>
              <p className="text-muted-foreground">• Code sent via SMTP email (10-min expiry)</p>
              <p className="text-muted-foreground">• Login blocked until code is verified</p>
              <p className="text-muted-foreground">• Code can be resent up to once per minute</p>
            </div>
            <div className={`p-3 rounded-xl border text-xs space-y-1 ${!emailVerificationEnabled ? "border-green-500/20 bg-green-500/5" : "border-border bg-background/30 opacity-50"}`}>
              <p className="font-medium text-foreground">When OFF</p>
              <p className="text-muted-foreground">• Account activated immediately on signup</p>
              <p className="text-muted-foreground">• Client redirected straight to dashboard</p>
              <p className="text-muted-foreground">• No OTP email sent</p>
              <p className="text-muted-foreground">• Existing verified accounts are unaffected</p>
            </div>
          </div>
        </div>

        {/* Session Settings */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-500/10 rounded-lg"><SettingsIcon className="w-5 h-5 text-orange-400" /></div>
            <h3 className="font-semibold text-foreground">Session Settings</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Session Timeout</p>
              <p className="text-xs text-muted-foreground">Auto-logout after 60 minutes of inactivity</p>
            </div>
            <Switch />
          </div>
        </div>

      </div>
    </div>
  );
}
