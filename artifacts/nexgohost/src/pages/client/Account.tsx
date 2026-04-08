import { useState } from "react";
import { useGetAccount, useUpdateAccount } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { User, Lock, Building, Phone, AtSign, CheckCircle2, Loader2 } from "lucide-react";

export default function ClientAccount() {
  const { data: account, isLoading, refetch } = useGetAccount();
  const updateAccount = useUpdateAccount();
  const { toast } = useToast();
  const { user, refreshUser } = useAuth() as any;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [usernameInput, setUsernameInput] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameSaved, setUsernameSaved] = useState(false);

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
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    updateAccount.mutate({ data: { currentPassword, newPassword } }, {
      onSuccess: () => { toast({ title: "Password changed successfully" }); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); },
      onError: () => toast({ title: "Failed to change password", variant: "destructive" }),
    });
  };

  const handleSaveUsername = async () => {
    const val = usernameInput.trim();
    if (!val || val === currentUsername) return;
    setUsernameLoading(true);
    setUsernameSaved(false);
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/auth/change-username", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
    } finally {
      setUsernameLoading(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Account Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your personal information and security</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg"><User className="w-5 h-5 text-primary" /></div>
          <h3 className="font-semibold text-foreground">Personal Information</h3>
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

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-violet-500/10 rounded-lg"><AtSign className="w-5 h-5 text-violet-500" /></div>
          <div>
            <h3 className="font-semibold text-foreground">Username</h3>
            <p className="text-xs text-muted-foreground">Use your username to log in instead of your email</p>
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
            <Button
              onClick={handleSaveUsername}
              disabled={usernameLoading || !usernameInput.trim() || usernameInput.trim() === currentUsername}
              variant="outline"
              className="shrink-0"
            >
              {usernameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : usernameSaved ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : "Save"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">3–20 characters, letters, numbers, and underscores only</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-orange-500/10 rounded-lg"><Lock className="w-5 h-5 text-orange-400" /></div>
          <h3 className="font-semibold text-foreground">Change Password</h3>
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
