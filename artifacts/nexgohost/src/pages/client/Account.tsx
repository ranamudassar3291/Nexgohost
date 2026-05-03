import { useState } from "react";
import { useGetAccount, useUpdateAccount } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/context/ThemeProvider";
import { useQuery } from "@tanstack/react-query";
import {
  User, Lock, AtSign, CheckCircle2, Loader2,
  Sun, Moon, Star, Zap, Award, Crown,
  Server, Globe, ShieldCheck, Calendar,
} from "lucide-react";
import { motion } from "framer-motion";

// ─── VIP Tier config ──────────────────────────────────────────────────────────
const VIP_TIERS = {
  Starter: { emoji: "🌱", color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", gradient: "linear-gradient(135deg,#F9FAFB,#F3F4F6)", icon: Star,       label: "Starter"   },
  Growth:  { emoji: "🚀", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", gradient: "linear-gradient(135deg,#EFF6FF,#DBEAFE)", icon: Zap,        label: "Growth"    },
  Pro:     { emoji: "💎", color: "#7C3AED", bg: "#F5F3FF", border: "#C4B5FD", gradient: "linear-gradient(135deg,#F5F3FF,#EDE9FE)", icon: Award,      label: "Pro"       },
  Elite:   { emoji: "👑", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", gradient: "linear-gradient(135deg,#FFFBEB,#FEF3C7)", icon: Crown,      label: "Elite"     },
} as const;

function authHeaders() {
  const t = localStorage.getItem("token");
  return { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
}

function formatDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// ─── Theme Switcher ───────────────────────────────────────────────────────────
function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--tw-text-foreground, #111827)", margin: "0 0 2px" }}>
            Appearance
          </p>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>
            Choose how the portal looks for you — saved permanently to your account.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {/* Light Mode card */}
        <button
          onClick={() => setTheme("light")}
          style={{
            flex: 1, padding: "14px 16px", borderRadius: 16,
            border: `2px solid ${!isDark ? "#6366F1" : "#E5E7EB"}`,
            background: !isDark ? "#EEF2FF" : "#FAFAFA",
            cursor: "pointer", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 8, transition: "all 0.2s",
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: !isDark ? "linear-gradient(135deg,#6366F1,#4F46E5)" : "#E5E7EB",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}>
            <Sun size={20} color={!isDark ? "#fff" : "#9CA3AF"} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: !isDark ? "#4F46E5" : "#374151", margin: "0 0 1px", textAlign: "center" }}>
              Light Mode
            </p>
            <p style={{ fontSize: 10, color: "#9CA3AF", margin: 0, textAlign: "center" }}>Clean & bright</p>
          </div>
          {!isDark && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              style={{ width: 20, height: 20, borderRadius: "50%", background: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={14} color="#fff" />
            </motion.div>
          )}
        </button>

        {/* Dark Mode card */}
        <button
          onClick={() => setTheme("dark")}
          style={{
            flex: 1, padding: "14px 16px", borderRadius: 16,
            border: `2px solid ${isDark ? "#6366F1" : "#E5E7EB"}`,
            background: isDark ? "#1E1B4B" : "#FAFAFA",
            cursor: "pointer", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 8, transition: "all 0.2s",
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: isDark ? "linear-gradient(135deg,#4F46E5,#1E1B4B)" : "#E5E7EB",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}>
            <Moon size={20} color={isDark ? "#A5B4FC" : "#9CA3AF"} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#A5B4FC" : "#374151", margin: "0 0 1px", textAlign: "center" }}>
              Executive Dark
            </p>
            <p style={{ fontSize: 10, color: isDark ? "#6366F1" : "#9CA3AF", margin: 0, textAlign: "center" }}>Elegant & focused</p>
          </div>
          {isDark && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              style={{ width: 20, height: 20, borderRadius: "50%", background: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={14} color="#fff" />
            </motion.div>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClientAccount() {
  const { data: account, isLoading, refetch } = useGetAccount();
  const updateAccount = useUpdateAccount();
  const { toast } = useToast();
  const { user, refreshUser } = useAuth() as any;

  const [firstName, setFirstName]         = useState("");
  const [lastName, setLastName]           = useState("");
  const [company, setCompany]             = useState("");
  const [phone, setPhone]                 = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameSaved, setUsernameSaved] = useState(false);

  // Loyalty data from DB
  const { data: prefs } = useQuery({
    queryKey: ["my-preferences"],
    queryFn: () => fetch("/api/my/preferences", { headers: authHeaders() }).then(r => r.json()),
    staleTime: 120_000,
  });

  if (!isLoading && account && firstName === "") {
    setFirstName(account.firstName);
    setLastName(account.lastName);
    setCompany(account.company || "");
    setPhone(account.phone || "");
  }
  if (!isLoading && account && usernameInput === "" && (account as any).username) {
    setUsernameInput((account as any).username || "");
  }
  const currentUsername = (account as any)?.username || (user as any)?.username || "";

  const handleSaveProfile = () => {
    updateAccount.mutate({ data: { firstName, lastName, company, phone } }, {
      onSuccess: () => { toast({ title: "Profile updated" }); refetch(); },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    });
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" }); return;
    }
    updateAccount.mutate({ data: { currentPassword, newPassword } }, {
      onSuccess: () => { toast({ title: "Password changed successfully" }); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); },
      onError: () => toast({ title: "Failed to change password", variant: "destructive" }),
    });
  };

  const handleSaveUsername = async () => {
    const val = usernameInput.trim();
    if (!val || val === currentUsername) return;
    setUsernameLoading(true); setUsernameSaved(false);
    try {
      const res = await fetch("/api/auth/change-username", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ username: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setUsernameSaved(true);
      setUsernameInput(data.username);
      if (refreshUser) refreshUser();
      refetch();
      toast({ title: "Username updated!" });
      setTimeout(() => setUsernameSaved(false), 3000);
    } catch (err: any) {
      toast({ title: err.message || "Could not update username", variant: "destructive" });
    } finally { setUsernameLoading(false); }
  };

  if (isLoading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
      <Loader2 size={24} className="animate-spin" style={{ color: "#C7D2FE" }} />
    </div>
  );

  const vipLevel  = (prefs?.vipLevel ?? "Starter") as keyof typeof VIP_TIERS;
  const tier      = VIP_TIERS[vipLevel] ?? VIP_TIERS.Starter;
  const TierIcon  = tier.icon;
  const memberSince = prefs?.memberSince ? formatDate(prefs.memberSince) : "—";
  const totalServices = prefs?.totalServices ?? 0;
  const vipProgress   = prefs?.vipProgress ?? 0;
  const vipNext       = prefs?.vipNext ?? null;
  const vipNextAt     = prefs?.vipNextAt ?? 1;
  const serviceCount  = prefs?.serviceCount ?? 0;
  const domainCount   = prefs?.domainCount ?? 0;

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Profile Hero ─────────────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 24, overflow: "hidden",
        border: `1px solid ${tier.border}`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      }}>
        {/* Gradient banner */}
        <div style={{
          background: tier.gradient,
          padding: "28px 28px 0",
          display: "flex", alignItems: "flex-end", gap: 20,
          position: "relative", overflow: "hidden",
        }}>
          {/* Decorative blobs */}
          <div style={{ position: "absolute", top: -30, right: -30, width: 160, height: 160, borderRadius: "50%", background: tier.color + "18", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 10, right: 60, width: 80, height: 80, borderRadius: "50%", background: tier.color + "10", pointerEvents: "none" }} />

          {/* Avatar */}
          <div style={{
            width: 80, height: 80, borderRadius: 24,
            background: `linear-gradient(135deg, ${tier.color}CC, ${tier.color})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, fontWeight: 900, color: "#fff",
            boxShadow: `0 8px 28px ${tier.color}44`,
            flexShrink: 0, marginBottom: -20, position: "relative", zIndex: 1,
            border: "3px solid #fff",
          }}>
            {account?.firstName?.[0]?.toUpperCase()}{account?.lastName?.[0]?.toUpperCase()}
          </div>

          {/* Name + badges */}
          <div style={{ flex: 1, paddingBottom: 24, position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: "#111827", margin: 0 }}>
                {account?.firstName} {account?.lastName}
              </h2>
              <span style={{
                padding: "3px 10px", borderRadius: 20,
                background: tier.color, color: "#fff",
                fontSize: 11, fontWeight: 800,
                display: "flex", alignItems: "center", gap: 5,
                boxShadow: `0 3px 10px ${tier.color}55`,
              }}>
                {tier.emoji} {tier.label}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>{account?.email}</p>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          background: "#fff",
          padding: "24px 28px 22px",
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16,
        }}>
          {[
            { icon: Calendar,   label: "Member Since",    value: memberSince,                 color: "#6366F1" },
            { icon: TierIcon,   label: "VIP Level",       value: tier.label,                  color: tier.color },
            { icon: Server,     label: "Active Hosting",  value: `${serviceCount} service${serviceCount !== 1 ? "s" : ""}`, color: "#0891B2" },
            { icon: Globe,      label: "Active Domains",  value: `${domainCount} domain${domainCount !== 1 ? "s" : ""}`,   color: "#059669" },
          ].map(stat => (
            <div key={stat.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <stat.icon size={13} color={stat.color} />
                <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {stat.label}
                </span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── VIP Loyalty Level ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div style={{ padding: "16px 22px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, background: tier.bg, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${tier.border}` }}>
              <TierIcon size={14} color={tier.color} />
            </div>
            <span className="text-foreground" style={{ fontSize: 14, fontWeight: 800 }}>Member Loyalty</span>
          </div>
        </div>

        <div style={{ padding: "0 22px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Current tier badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 16px", borderRadius: 14,
            background: tier.gradient, border: `1px solid ${tier.border}`,
          }}>
            <div style={{ fontSize: 28 }}>{tier.emoji}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 900, color: tier.color, margin: "0 0 2px" }}>{tier.label} Member</p>
              <p className="text-muted-foreground" style={{ fontSize: 12, margin: 0 }}>
                {totalServices} active service{totalServices !== 1 ? "s" : ""} · {vipNext ? `Reach ${vipNextAt} services for ${vipNext}` : "You've reached the highest tier!"}
              </p>
            </div>
            {!vipNext && <CheckCircle2 size={18} color={tier.color} />}
          </div>

          {/* Progress bar to next tier */}
          {vipNext && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="text-muted-foreground" style={{ fontSize: 11, fontWeight: 700 }}>Progress to {vipNext}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: tier.color }}>{vipProgress}%</span>
              </div>
              <div style={{ height: 7, borderRadius: 8, background: "#F3F4F6", overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${vipProgress}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  style={{ height: "100%", borderRadius: 8, background: `linear-gradient(90deg, ${tier.color}, ${tier.color}cc)` }}
                />
              </div>
              <p className="text-muted-foreground" style={{ fontSize: 10, marginTop: 4, textAlign: "right" }}>
                {totalServices} / {vipNextAt} services
              </p>
            </div>
          )}

          {/* Tier ladder */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {(Object.entries(VIP_TIERS) as [keyof typeof VIP_TIERS, typeof VIP_TIERS[keyof typeof VIP_TIERS]][]).map(([lvl, t]) => {
              const isActive = lvl === vipLevel;
              return (
                <div key={lvl} style={{
                  padding: "10px 8px", borderRadius: 12, textAlign: "center",
                  background: isActive ? t.bg : "transparent",
                  border: `1px solid ${isActive ? t.border : "#F3F4F6"}`,
                  opacity: !isActive && Object.keys(VIP_TIERS).indexOf(lvl) > Object.keys(VIP_TIERS).indexOf(vipLevel) ? 0.45 : 1,
                }}>
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{t.emoji}</div>
                  <p style={{ fontSize: 10, fontWeight: 800, color: isActive ? t.color : "#9CA3AF", margin: 0 }}>{t.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Appearance / Theme Switcher ───────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <ThemeSwitcher />
      </div>

      {/* ── Personal Information ──────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User size={15} color="#4F46E5" />
          </div>
          <div>
            <h3 className="text-foreground" style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Personal Information</h3>
            <p className="text-muted-foreground" style={{ fontSize: 12, margin: 0 }}>Your name, phone, and company details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">First Name</label>
            <Input value={firstName} onChange={e => setFirstName(e.target.value)} className="bg-background border-border" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Last Name</label>
            <Input value={lastName} onChange={e => setLastName(e.target.value)} className="bg-background border-border" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <Input value={account?.email || ""} disabled className="bg-background border-border opacity-60" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Phone</label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} className="bg-background border-border" placeholder="+1-555-0000" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-muted-foreground">Company</label>
            <Input value={company} onChange={e => setCompany(e.target.value)} className="bg-background border-border" placeholder="Your company name" />
          </div>
        </div>

        <Button onClick={handleSaveProfile} disabled={updateAccount.isPending} className="bg-primary hover:bg-primary/90">
          {updateAccount.isPending ? "Saving..." : "Save Profile"}
        </Button>
      </div>

      {/* ── Username ──────────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AtSign size={15} color="#7C3AED" />
          </div>
          <div>
            <h3 className="text-foreground" style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Username</h3>
            <p className="text-muted-foreground" style={{ fontSize: 12, margin: 0 }}>Use your username to log in instead of your email</p>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Username</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">@</span>
              <Input
                value={usernameInput}
                onChange={e => { setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setUsernameSaved(false); }}
                className="bg-background border-border pl-7"
                placeholder="yourname1234"
                maxLength={20}
              />
            </div>
            <Button onClick={handleSaveUsername} disabled={usernameLoading || !usernameInput.trim() || usernameInput.trim() === currentUsername} variant="outline" className="shrink-0">
              {usernameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : usernameSaved ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : "Save"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">3–20 characters, letters, numbers, and underscores only</p>
        </div>
      </div>

      {/* ── Change Password ────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Lock size={15} color="#D97706" />
          </div>
          <div>
            <h3 className="text-foreground" style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Change Password</h3>
            <p className="text-muted-foreground" style={{ fontSize: 12, margin: 0 }}>Use a strong, unique password for best security</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Current Password</label>
            <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="bg-background border-border" placeholder="••••••••" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">New Password</label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-background border-border" placeholder="••••••••" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Confirm New Password</label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="bg-background border-border" placeholder="••••••••" />
          </div>
        </div>
        <Button variant="outline" onClick={handleChangePassword} disabled={updateAccount.isPending || !currentPassword || !newPassword}>
          Change Password
        </Button>
      </div>
    </div>
  );
}
