import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import { UserCog, ArrowLeft, Loader2, Wallet, RefreshCw, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";

export default function EditClient() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", company: "", phone: "", status: "active",
  });
  const [canMigrate, setCanMigrate] = useState(false);
  const [savingMigrate, setSavingMigrate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [creditBalance, setCreditBalance] = useState<string>("0");
  const [newCreditAmount, setNewCreditAmount] = useState("");
  const [creditAction, setCreditAction] = useState<"admin_add" | "admin_deduct" | "set">("set");
  const [savingCredit, setSavingCredit] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    Promise.all([
      fetch(`/api/admin/clients/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`/api/admin/users/${id}/credits`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([data, credData]) => {
        setForm({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          company: data.company || "",
          phone: data.phone || "",
          status: data.status || "active",
        });
        setCanMigrate(data.canMigrate === true);
        setCreditBalance(credData.creditBalance ?? "0");
      })
      .catch(() => toast({ title: "Error", description: "Could not load client data", variant: "destructive" }))
      .finally(() => setFetching(false));
  }, [id]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(err => ({ ...err, [field]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim()) e.lastName = "Last name is required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update client");
      toast({ title: "Client updated", description: `${form.firstName} ${form.lastName} has been updated.` });
      setLocation(`/admin/clients/${id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCanMigrateToggle = async (newValue: boolean) => {
    setSavingMigrate(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/clients/${id}/can-migrate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ canMigrate: newValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setCanMigrate(data.canMigrate === true);
      toast({ title: newValue ? "Migration enabled" : "Migration disabled", description: `Client can ${newValue ? "now" : "no longer"} request website migrations.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingMigrate(false);
    }
  };

  const handleCreditUpdate = async () => {
    const amt = parseFloat(newCreditAmount);
    if (isNaN(amt) || amt <= 0) { toast({ title: "Error", description: "Enter a valid positive amount", variant: "destructive" }); return; }
    setSavingCredit(true);
    try {
      const token = localStorage.getItem("token");
      let body: Record<string, unknown>;
      if (creditAction === "set") {
        const current = parseFloat(creditBalance ?? "0");
        const diff = amt - current;
        if (diff === 0) { toast({ title: "No change", description: "Balance is already at that amount" }); setSavingCredit(false); return; }
        body = {
          amount: Math.abs(diff),
          type: diff > 0 ? "admin_add" : "admin_deduct",
          description: `Balance manually set to Rs. ${amt.toFixed(2)} by admin`,
        };
      } else {
        body = {
          amount: amt,
          type: creditAction,
          description: creditAction === "admin_add" ? `Rs. ${amt} added by admin` : `Rs. ${amt} deducted by admin`,
        };
      }
      const res = await fetch(`/api/admin/users/${id}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update credit");
      setCreditBalance(data.creditBalance);
      setNewCreditAmount("");
      toast({ title: "Balance updated", description: `New balance: Rs. ${parseFloat(data.creditBalance).toFixed(2)}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSavingCredit(false); }
  };

  if (fetching) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/admin/clients/${id}`)} className="rounded-xl">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Edit Client</h1>
          <p className="text-muted-foreground text-sm">Update client account details</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-5">
        {/* Client Info */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserCog size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Client Information</h2>
              <p className="text-xs text-muted-foreground">Update the fields below and save</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">First Name *</label>
                <Input value={form.firstName} onChange={set("firstName")} placeholder="John" className={errors.firstName ? "border-destructive" : ""} />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Last Name *</label>
                <Input value={form.lastName} onChange={set("lastName")} placeholder="Doe" className={errors.lastName ? "border-destructive" : ""} />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Email Address *</label>
              <Input type="email" value={form.email} onChange={set("email")} placeholder="john@example.com" className={errors.email ? "border-destructive" : ""} />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Company</label>
                <Input value={form.company} onChange={set("company")} placeholder="Acme Corp (optional)" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Phone</label>
                <Input value={form.phone} onChange={set("phone")} placeholder="+92 300 0000000" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Status</label>
              <select value={form.status} onChange={set("status")} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1 bg-primary hover:bg-primary/90">
                {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <UserCog size={18} className="mr-2" />}
                {loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setLocation(`/admin/clients/${id}`)}>Cancel</Button>
            </div>
          </form>
        </div>

        {/* Account Balance */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Wallet size={20} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Account Balance</h2>
              <p className="text-xs text-muted-foreground">Manually adjust this client's wallet balance</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 mb-5">
            <p className="text-xs text-muted-foreground mb-1 font-medium">Current Balance</p>
            <p className="text-2xl font-extrabold text-green-600">{formatPrice(parseFloat(creditBalance ?? "0"))}</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Action</label>
              <div className="flex gap-2">
                {[
                  { value: "set", label: "Set to Amount" },
                  { value: "admin_add", label: "Add" },
                  { value: "admin_deduct", label: "Deduct" },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setCreditAction(opt.value as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      creditAction === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary/50"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">
                Amount (PKR) {creditAction === "set" ? "— new balance" : creditAction === "admin_add" ? "— to add" : "— to deduct"}
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">Rs.</span>
                  <Input
                    type="number" min="0.01" step="0.01"
                    value={newCreditAmount}
                    onChange={e => setNewCreditAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleCreditUpdate} disabled={savingCredit || !newCreditAmount} className="bg-primary hover:bg-primary/90">
                  {savingCredit ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  <span className="ml-2">Update</span>
                </Button>
              </div>
              {creditAction === "set" && (
                <p className="text-[11px] text-muted-foreground">The system will automatically add or deduct the difference to reach this exact balance.</p>
              )}
            </div>
          </div>
        </div>

        {/* Migration Access */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <ArrowRightLeft size={20} className="text-violet-600" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Migration Access</h2>
              <p className="text-xs text-muted-foreground">Allow this client to request website migrations via 20i</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/50">
            <div>
              <p className="font-medium text-sm text-foreground">Website Migration Enabled</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {canMigrate
                  ? "Client can submit migration requests and use 20i migration features."
                  : "Client cannot access the migration system."}
              </p>
            </div>
            <button
              onClick={() => handleCanMigrateToggle(!canMigrate)}
              disabled={savingMigrate}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                canMigrate ? "bg-violet-600" : "bg-muted"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                canMigrate ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
