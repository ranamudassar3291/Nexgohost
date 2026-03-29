import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, Pencil, Trash2, Shield, ShieldCheck, ShieldAlert, ShieldOff,
  Eye, EyeOff, X, Check, Loader2, KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type AdminPermission = "super_admin" | "full" | "support" | "limited";

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: "active" | "suspended";
  adminPermission: AdminPermission | null;
  createdAt: string;
}

const PERMISSION_META: Record<AdminPermission, { label: string; description: string; color: string; bg: string; icon: typeof Shield }> = {
  super_admin: {
    label: "Super Admin",
    description: "Full unrestricted access including admin user management",
    color: "#4F46E5",
    bg: "#4F46E515",
    icon: ShieldAlert,
  },
  full: {
    label: "Full Access",
    description: "Complete access to all admin panel features",
    color: "#16a34a",
    bg: "#16a34a15",
    icon: ShieldCheck,
  },
  support: {
    label: "Support",
    description: "Access to tickets, clients (view only), and support tools",
    color: "#d97706",
    bg: "#d9770615",
    icon: Shield,
  },
  limited: {
    label: "Limited",
    description: "Dashboard and read-only access to select sections",
    color: "#6b7280",
    bg: "#6b728015",
    icon: ShieldOff,
  },
};

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") ?? "";
  return fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
}

function PermissionBadge({ perm }: { perm: AdminPermission | null }) {
  if (!perm) return <span className="text-xs text-muted-foreground">—</span>;
  const meta = PERMISSION_META[perm];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ color: meta.color, background: meta.bg }}
    >
      <Icon size={11} />
      {meta.label}
    </span>
  );
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  adminPermission: AdminPermission | "";
  status: "active" | "suspended";
}

const defaultForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  adminPermission: "full",
  status: "active",
};

interface ModalProps {
  mode: "add" | "edit";
  initial?: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}

function AdminUserModal({ mode, initial, onClose, onSaved }: ModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          firstName: initial.firstName,
          lastName: initial.lastName,
          email: initial.email,
          password: "",
          adminPermission: initial.adminPermission ?? "full",
          status: initial.status,
        }
      : defaultForm,
  );
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email) {
      toast({ title: "Missing fields", description: "First name, last name, and email are required.", variant: "destructive" });
      return;
    }
    if (mode === "add" && !form.password) {
      toast({ title: "Password required", description: "Please set a password for the new admin.", variant: "destructive" });
      return;
    }
    if (form.password && form.password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (!form.adminPermission) {
      toast({ title: "Permission required", description: "Please select an access level.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        adminPermission: form.adminPermission,
        status: form.status,
      };
      if (form.password) body.password = form.password;

      const res = await apiFetch(
        mode === "add" ? "/api/admin/admin-users" : `/api/admin/admin-users/${initial!.id}`,
        { method: mode === "add" ? "POST" : "PUT", body: JSON.stringify(body) },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast({ title: mode === "add" ? "Admin created" : "Admin updated", description: `${form.firstName} ${form.lastName} has been ${mode === "add" ? "added" : "updated"}.` });
      onSaved();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full px-3 py-2.5 border border-border/60 rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {mode === "add" ? "Add Admin User" : "Edit Admin User"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === "add" ? "Create a new admin account with specific access" : "Update this admin's details and access level"}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">First Name *</label>
              <input className={inputClass} value={form.firstName} onChange={set("firstName")} placeholder="John" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Last Name *</label>
              <input className={inputClass} value={form.lastName} onChange={set("lastName")} placeholder="Doe" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Email Address *</label>
            <input className={inputClass} type="email" value={form.email} onChange={set("email")} placeholder="admin@example.com" required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              {mode === "add" ? "Password *" : "New Password"}{" "}
              {mode === "edit" && <span className="font-normal opacity-60">(leave blank to keep current)</span>}
            </label>
            <div className="relative">
              <input
                className={`${inputClass} pr-10`}
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                placeholder={mode === "add" ? "Min. 6 characters" : "Enter new password to change"}
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">Access Level *</label>
            <div className="space-y-2">
              {(["full", "support", "limited"] as AdminPermission[]).map((perm) => {
                const meta = PERMISSION_META[perm];
                const Icon = meta.icon;
                const selected = form.adminPermission === perm;
                return (
                  <button
                    key={perm}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, adminPermission: perm }))}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all"
                    style={selected ? { borderColor: meta.color, background: meta.bg } : { borderColor: "var(--border)", background: "transparent" }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: selected ? meta.bg : "var(--secondary)" }}>
                      <Icon size={16} style={{ color: selected ? meta.color : "var(--muted-foreground)" }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all"
                      style={selected ? { background: meta.color, borderColor: meta.color } : { borderColor: "var(--border)" }}>
                      {selected && <Check size={10} strokeWidth={3} className="text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {mode === "edit" && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Account Status</label>
              <select className={inputClass} value={form.status} onChange={set("status")}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl h-11">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1 rounded-xl h-11 bg-primary hover:bg-primary/90">
              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : mode === "add" ? <UserPlus size={16} className="mr-2" /> : <Check size={16} className="mr-2" />}
              {saving ? "Saving…" : mode === "add" ? "Create Admin" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);

  const { data, isLoading } = useQuery<{ admins: AdminUser[] }>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/admin-users");
      if (!res.ok) throw new Error("Failed to load admin users");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/admin/admin-users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Admin removed", description: "The admin account has been deleted." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function handleDelete(admin: AdminUser) {
    if (admin.id === currentUser?.id) {
      toast({ title: "Cannot delete", description: "You cannot delete your own account.", variant: "destructive" });
      return;
    }
    if (!confirm(`Delete admin "${admin.firstName} ${admin.lastName}"? This action cannot be undone.`)) return;
    deleteMutation.mutate(admin.id);
  }

  function openEdit(admin: AdminUser) {
    setEditTarget(admin);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditTarget(null);
  }

  function onSaved() {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    closeModal();
  }

  const admins = data?.admins ?? [];

  return (
    <div className="space-y-6">
      {(modalMode === "add" || modalMode === "edit") && (
        <AdminUserModal
          mode={modalMode}
          initial={editTarget ?? undefined}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Admin Users</h2>
          <p className="text-muted-foreground mt-1">Manage admin accounts and their access levels</p>
        </div>
        <Button
          onClick={() => setModalMode("add")}
          className="bg-primary hover:bg-primary/90 h-11 rounded-xl whitespace-nowrap"
        >
          <UserPlus size={16} className="mr-2" /> Add Admin
        </Button>
      </div>

      {/* Permission level legend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(["super_admin", "full", "support", "limited"] as AdminPermission[]).map((perm) => {
          const meta = PERMISSION_META[perm];
          const Icon = meta.icon;
          return (
            <div key={perm} className="bg-card border border-border rounded-xl p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
                <Icon size={16} style={{ color: meta.color }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{meta.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-secondary/50 border-b border-border">
                <th className="p-4 font-medium text-sm text-muted-foreground">Admin</th>
                <th className="p-4 font-medium text-sm text-muted-foreground">Email</th>
                <th className="p-4 font-medium text-sm text-muted-foreground">Access Level</th>
                <th className="p-4 font-medium text-sm text-muted-foreground">Status</th>
                <th className="p-4 font-medium text-sm text-muted-foreground">Added</th>
                <th className="p-4 font-medium text-sm text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted-foreground text-sm">
                    No admin users found.
                  </td>
                </tr>
              ) : (
                admins.map((admin) => {
                  const isSelf = admin.id === currentUser?.id;
                  return (
                    <tr key={admin.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                            style={{ background: "#4F46E520", color: "#4F46E5" }}>
                            {admin.firstName[0]}{admin.lastName[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">
                              {admin.firstName} {admin.lastName}
                              {isSelf && (
                                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">YOU</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{admin.email}</td>
                      <td className="p-4">
                        <PermissionBadge perm={admin.adminPermission} />
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          admin.status === "active"
                            ? "bg-green-500/10 text-green-600"
                            : "bg-red-500/10 text-red-600"
                        }`}>
                          {admin.status === "active" ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(admin.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(admin)}
                            title="Edit admin"
                            className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <Pencil size={15} />
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => handleDelete(admin)}
                              title="Delete admin"
                              disabled={deleteMutation.isPending}
                              className="p-2 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500 disabled:opacity-40"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
        <KeyRound size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 dark:text-amber-300">
          <strong>Security tip:</strong> Use the minimum required access level for each admin.
          Only assign "Full Access" to trusted staff who need complete panel control.
          "Support" accounts can manage tickets and view clients but cannot change billing or system settings.
        </div>
      </div>
    </div>
  );
}
