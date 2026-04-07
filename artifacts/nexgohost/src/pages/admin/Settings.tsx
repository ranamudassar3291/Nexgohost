import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, Bell, ShieldOff, Globe, Mail, Loader2, ChevronRight, MailCheck, Wallet, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

interface PlatformSettings {
  email_verification_enabled: boolean;
  wallet_min_deposit: number;
  wallet_max_deposit: number;
}

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

  // ── Wallet Settings ───────────────────────────────────────────────────────
  const [walletMin, setWalletMin] = useState<string>("");
  const [walletMax, setWalletMax] = useState<string>("");
  const [savingWallet, setSavingWallet] = useState(false);

  // Populate wallet fields from platform settings
  const walletMinValue = walletMin !== "" ? walletMin : String(platformSettings?.wallet_min_deposit ?? 270);
  const walletMaxValue = walletMax !== "" ? walletMax : String(platformSettings?.wallet_max_deposit ?? 100000);

  // ── Announcement Banner ──────────────────────────────────────────────────
  interface AnnouncementItem { id: string; title: string; message: string; type: string; isActive: boolean; priority: number; }
  const { data: announcementsData, refetch: refetchAnnouncements } = useQuery<{ announcements: AnnouncementItem[] }>({
    queryKey: ["admin-announcements-settings"],
    queryFn: () => apiFetch("/api/admin/announcements"),
  });
  const firstAnnouncement = announcementsData?.announcements?.[0] ?? null;
  const [bannerText, setBannerText] = useState<string>("");
  const [bannerActive, setBannerActive] = useState<boolean | null>(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const bannerTextValue = bannerText !== "" ? bannerText : (firstAnnouncement ? `${firstAnnouncement.title} ${firstAnnouncement.message}` : "");
  const bannerActiveValue = bannerActive !== null ? bannerActive : (firstAnnouncement?.isActive ?? true);

  const handleSaveBanner = async () => {
    setSavingBanner(true);
    try {
      const combined = bannerTextValue.trim();
      const title = firstAnnouncement?.title ?? "🚀 Welcome to Noehost!";
      const message = combined;
      const body = { title, message, type: firstAnnouncement?.type ?? "info", isActive: bannerActiveValue, priority: firstAnnouncement?.priority ?? 10 };
      if (firstAnnouncement) {
        await apiFetch(`/api/admin/announcements/${firstAnnouncement.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/admin/announcements", { method: "POST", body: JSON.stringify(body) });
      }
      await refetchAnnouncements();
      toast({ title: "Announcement saved", description: "The marquee banner has been updated." });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally { setSavingBanner(false); }
  };

  const handleSaveWallet = async () => {
    const min = Number(walletMinValue);
    const max = Number(walletMaxValue);
    if (isNaN(min) || min < 1) { toast({ title: "Invalid minimum", description: "Minimum deposit must be at least 1", variant: "destructive" }); return; }
    if (isNaN(max) || max <= min) { toast({ title: "Invalid maximum", description: "Maximum must be greater than minimum", variant: "destructive" }); return; }
    setSavingWallet(true);
    try {
      await apiFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify({ wallet_min_deposit: min, wallet_max_deposit: max }) });
      await refetchPlatformSettings();
      toast({ title: "Wallet limits saved", description: `Min: Rs. ${min.toLocaleString()}, Max: Rs. ${max.toLocaleString()}` });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally { setSavingWallet(false); }
  };

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

        {/* 2FA — bypassed for admin accounts */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg"><ShieldOff className="w-5 h-5 text-amber-400" /></div>
            <div>
              <h3 className="font-semibold text-foreground">Two-Factor Authentication</h3>
              <p className="text-xs text-muted-foreground mt-0.5">2FA status for this admin account</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-sm text-amber-700">
            <ShieldOff size={16} className="shrink-0 mt-0.5" />
            <p>2FA is <strong>bypassed for all admin accounts</strong>. Admin logins use password authentication only — no authenticator code is ever required, regardless of whether 2FA is configured on the account.</p>
          </div>
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

        {/* Wallet Settings */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg"><Wallet className="w-5 h-5 text-green-500" /></div>
            <div>
              <h3 className="font-semibold text-foreground">Wallet Settings</h3>
              <p className="text-xs text-muted-foreground">Set deposit limits for client wallet top-ups</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Minimum Deposit (PKR)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rs.</span>
                <Input
                  type="number" min="1"
                  value={walletMinValue}
                  onChange={e => setWalletMin(e.target.value)}
                  className="pl-10 bg-background border-border"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Clients cannot deposit less than this amount</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Maximum Deposit (PKR)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rs.</span>
                <Input
                  type="number" min="1"
                  value={walletMaxValue}
                  onChange={e => setWalletMax(e.target.value)}
                  className="pl-10 bg-background border-border"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Clients cannot deposit more than this amount</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleSaveWallet} disabled={savingWallet} className="bg-primary hover:bg-primary/90">
              {savingWallet ? <><Loader2 size={15} className="animate-spin mr-2"/>Saving…</> : "Save Wallet Limits"}
            </Button>
            <p className="text-[11px] text-muted-foreground">Current: Rs. {Number(walletMinValue).toLocaleString()} – Rs. {Number(walletMaxValue).toLocaleString()}</p>
          </div>
        </div>

        {/* Announcement Banner */}
        <div className="p-6 border-t border-border/50">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-500/10 rounded-lg"><Megaphone className="w-5 h-5 text-blue-500" /></div>
            <div>
              <h3 className="font-semibold text-foreground">Announcement Banner</h3>
              <p className="text-xs text-muted-foreground">Controls the scrolling marquee shown at the top of the client dashboard</p>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
              <div>
                <p className="text-sm font-medium text-foreground">Show announcement bar</p>
                <p className="text-xs text-muted-foreground">Toggle to show or hide the scrolling marquee for all clients</p>
              </div>
              <Switch
                checked={bannerActiveValue}
                onCheckedChange={v => setBannerActive(v)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Announcement Text</label>
              <Textarea
                rows={2}
                placeholder="e.g. 🚀 Welcome to Noehost! Experience 99.9% Uptime with our new Optimized VPS Nodes."
                value={bannerTextValue}
                onChange={e => setBannerText(e.target.value)}
                className="bg-background border-border resize-none"
              />
              <p className="text-[11px] text-muted-foreground">This text scrolls across the blue banner on the client dashboard. For more control (multiple messages, types, priorities) visit the Announcements page.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleSaveBanner} disabled={savingBanner} className="bg-blue-600 hover:bg-blue-700 text-white">
                {savingBanner ? <><Loader2 size={15} className="animate-spin mr-2"/>Saving…</> : "Save Banner"}
              </Button>
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
