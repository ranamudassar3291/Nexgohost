import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2, Shield, ShieldOff, ArrowLeftRight, ListOrdered, Eye, EyeOff, Sparkles, Save } from "lucide-react";
import { useCurrency } from "@/context/CurrencyProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface DomainExtension {
  id: string;
  extension: string;
  registerPrice: string;
  register2YearPrice: string | null;
  register3YearPrice: string | null;
  renewalPrice: string;
  renew2YearPrice: string | null;
  renew3YearPrice: string | null;
  transferPrice: string;
  privacyEnabled: boolean;
  isFreeWithHosting: boolean;
  transferAllowed: boolean;
  sortOrder: number;
  showInSuggestions: boolean;
  status: "active" | "inactive";
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const EMPTY = {
  extension: "",
  registerPrice: "", register2YearPrice: "", register3YearPrice: "",
  renewalPrice: "", renew2YearPrice: "", renew3YearPrice: "",
  transferPrice: "", privacyEnabled: true, isFreeWithHosting: false, transferAllowed: true,
  sortOrder: "999", showInSuggestions: true,
};

interface PromoConfig {
  enabled: boolean;
  tld: string;
  price: number;
  originalPrice: number;
  text: string;
  years: number;
}

export default function DomainExtensions() {
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [promoForm, setPromoForm] = useState<PromoConfig | null>(null);
  const [savingPromo, setSavingPromo] = useState(false);

  const { data: extensions = [], isLoading } = useQuery<DomainExtension[]>({
    queryKey: ["admin-domain-extensions"],
    queryFn: () => apiFetch("/api/admin/domain-extensions"),
  });

  const { data: promoData } = useQuery<PromoConfig>({
    queryKey: ["admin-domain-promo"],
    queryFn: () => fetch("/api/domain-search/promo", { credentials: "include" }).then(r => r.json()),
    staleTime: 60_000,
  });

  const promo = promoForm ?? promoData ?? { enabled: true, tld: ".com", price: 99, originalPrice: 3000, text: "Special deal — Get a .com domain for Rs. 99/1st year when you buy for 3 years", years: 3 };

  async function savePromo() {
    setSavingPromo(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/domain-search/promo", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(promo),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["admin-domain-promo"] });
      queryClient.invalidateQueries({ queryKey: ["domain-promo"] });
      toast({ title: "Promo banner saved", description: "Changes are live on the Domain Search page." });
    } catch {
      toast({ title: "Error", description: "Failed to save promo banner", variant: "destructive" });
    } finally {
      setSavingPromo(false);
    }
  }

  function setPromo(patch: Partial<PromoConfig>) {
    setPromoForm(prev => ({ ...(prev ?? promo), ...patch }));
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.extension || !form.registerPrice || !form.renewalPrice || !form.transferPrice) {
      toast({ title: "Error", description: "Extension, 1-year register/renewal, and transfer price are required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const body = {
        extension: form.extension,
        registerPrice: form.registerPrice,
        register2YearPrice: form.register2YearPrice || null,
        register3YearPrice: form.register3YearPrice || null,
        renewalPrice: form.renewalPrice,
        renew2YearPrice: form.renew2YearPrice || null,
        renew3YearPrice: form.renew3YearPrice || null,
        transferPrice: form.transferPrice,
        privacyEnabled: form.privacyEnabled,
        isFreeWithHosting: form.isFreeWithHosting,
        transferAllowed: form.transferAllowed,
        sortOrder: Number(form.sortOrder) || 999,
        showInSuggestions: form.showInSuggestions,
      };
      if (editId) {
        await apiFetch(`/api/admin/domain-extensions/${editId}`, { method: "PUT", body: JSON.stringify(body) });
        toast({ title: "Extension updated" });
      } else {
        await apiFetch("/api/admin/domain-extensions", { method: "POST", body: JSON.stringify(body) });
        toast({ title: "Extension added", description: `${form.extension} is now available.` });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-domain-extensions"] });
      setForm(EMPTY); setShowForm(false); setEditId(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleEdit = (ext: DomainExtension) => {
    setEditId(ext.id);
    setForm({
      extension: ext.extension,
      registerPrice: ext.registerPrice,
      register2YearPrice: ext.register2YearPrice || "",
      register3YearPrice: ext.register3YearPrice || "",
      renewalPrice: ext.renewalPrice,
      renew2YearPrice: ext.renew2YearPrice || "",
      renew3YearPrice: ext.renew3YearPrice || "",
      transferPrice: ext.transferPrice,
      privacyEnabled: ext.privacyEnabled,
      isFreeWithHosting: ext.isFreeWithHosting ?? false,
      transferAllowed: ext.transferAllowed ?? true,
      sortOrder: String(ext.sortOrder ?? 999),
      showInSuggestions: ext.showInSuggestions ?? true,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this extension?")) return;
    try {
      await apiFetch(`/api/admin/domain-extensions/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["admin-domain-extensions"] });
      toast({ title: "Extension deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleToggle = async (ext: DomainExtension, field: "status" | "privacyEnabled" | "isFreeWithHosting" | "transferAllowed" | "showInSuggestions") => {
    try {
      const body =
        field === "status"            ? { status: ext.status === "active" ? "inactive" : "active" } :
        field === "privacyEnabled"    ? { privacyEnabled: !ext.privacyEnabled } :
        field === "isFreeWithHosting" ? { isFreeWithHosting: !ext.isFreeWithHosting } :
        field === "transferAllowed"   ? { transferAllowed: !ext.transferAllowed } :
                                        { showInSuggestions: !ext.showInSuggestions };
      await apiFetch(`/api/admin/domain-extensions/${ext.id}`, { method: "PUT", body: JSON.stringify(body) });
      queryClient.invalidateQueries({ queryKey: ["admin-domain-extensions"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const priceOrDash = (v: string | null | undefined) => v ? formatPrice(Number(v)) : <span className="text-muted-foreground/40">—</span>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Domain Extensions</h1>
          <p className="text-muted-foreground text-sm">Manage TLD pricing (.com, .net, .org, .pk…) and search display order</p>
        </div>
        <Button onClick={() => { setEditId(null); setForm(EMPTY); setShowForm(true); }} className="bg-primary hover:bg-primary/90">
          <Plus size={16} className="mr-2" /> Add Extension
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Globe size={18} className="text-primary" />
            </div>
            <h2 className="font-semibold">{editId ? "Edit Extension" : "Add Domain Extension"}</h2>
          </div>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Extension (e.g. .com)</label>
                <Input value={form.extension} onChange={set("extension")} placeholder=".com" disabled={!!editId} className="max-w-xs" />
              </div>
              <div className="space-y-1.5 max-w-[140px]">
                <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                  <ListOrdered size={14} className="text-primary" /> Sort Order
                </label>
                <Input
                  type="number" min="1" max="9999" step="1"
                  value={form.sortOrder}
                  onChange={set("sortOrder")}
                  placeholder="999"
                />
                <p className="text-xs text-muted-foreground">Lower = shown first to clients</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Registration Pricing (PKR)</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { field: "registerPrice", label: "1 Year *" },
                  { field: "register2YearPrice", label: "2 Years" },
                  { field: "register3YearPrice", label: "3 Years" },
                ].map(({ field, label }) => (
                  <div key={field} className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground/70">{label}</label>
                    <Input type="number" step="0.01" min="0" value={form[field as keyof typeof form] as string} onChange={set(field)} placeholder="0.00" />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Renewal Pricing (PKR)</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { field: "renewalPrice", label: "1 Year *" },
                  { field: "renew2YearPrice", label: "2 Years" },
                  { field: "renew3YearPrice", label: "3 Years" },
                ].map(({ field, label }) => (
                  <div key={field} className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground/70">{label}</label>
                    <Input type="number" step="0.01" min="0" value={form[field as keyof typeof form] as string} onChange={set(field)} placeholder="0.00" />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 max-w-xs">
              <label className="text-sm font-medium text-foreground/80">Transfer Price (PKR) *</label>
              <Input type="number" step="0.01" min="0" value={form.transferPrice} onChange={set("transferPrice")} placeholder="0.00" />
            </div>

            {/* Show in Suggestions */}
            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl max-w-md">
              <Eye size={16} className="text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Show in Suggestions</p>
                <p className="text-xs text-muted-foreground">Display this TLD in client domain search results. If off, only appears when client explicitly types this extension.</p>
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, showInSuggestions: !f.showInSuggestions }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.showInSuggestions ? "bg-primary" : "bg-muted"}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.showInSuggestions ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl max-w-md">
              <Shield size={16} className="text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Domain Privacy Protection</p>
                <p className="text-xs text-muted-foreground">Free WHOIS privacy for clients</p>
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, privacyEnabled: !f.privacyEnabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.privacyEnabled ? "bg-primary" : "bg-muted"}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.privacyEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-xl max-w-md">
              <Globe size={16} className="text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Free with Hosting</p>
                <p className="text-xs text-muted-foreground">Offered free on eligible yearly plans (when plan has no TLD list)</p>
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, isFreeWithHosting: !f.isFreeWithHosting }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isFreeWithHosting ? "bg-green-500" : "bg-muted"}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isFreeWithHosting ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl max-w-md">
              <ArrowLeftRight size={16} className="text-blue-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Allow Domain Transfers</p>
                <p className="text-xs text-muted-foreground">Allow clients to transfer domains with this TLD into Noehost</p>
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, transferAllowed: !f.transferAllowed }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.transferAllowed ? "bg-blue-500" : "bg-muted"}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.transferAllowed ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
                {saving && <Loader2 size={16} className="animate-spin mr-2" />}
                {editId ? "Save Changes" : "Add Extension"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY); }}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead>
              <tr className="bg-secondary/50 border-b border-border">
                <th className="p-4 text-sm font-medium text-muted-foreground w-12 text-center">#</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Extension</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Reg 1yr</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Reg 2yr</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Reg 3yr</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Ren 1yr</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Ren 2yr</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Ren 3yr</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Transfer</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Suggest</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Privacy</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Free w/ Host</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Transfers</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="p-4 text-sm font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={15} className="p-8 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></td></tr>
              ) : extensions.length === 0 ? (
                <tr><td colSpan={15} className="p-8 text-center text-muted-foreground">No extensions added yet.</td></tr>
              ) : extensions.map(ext => (
                <tr key={ext.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                      {ext.sortOrder}
                    </span>
                  </td>
                  <td className="p-4 font-mono font-semibold text-primary">{ext.extension}</td>
                  <td className="p-4 text-sm">{formatPrice(Number(ext.registerPrice))}</td>
                  <td className="p-4 text-sm">{priceOrDash(ext.register2YearPrice)}</td>
                  <td className="p-4 text-sm">{priceOrDash(ext.register3YearPrice)}</td>
                  <td className="p-4 text-sm">{formatPrice(Number(ext.renewalPrice))}</td>
                  <td className="p-4 text-sm">{priceOrDash(ext.renew2YearPrice)}</td>
                  <td className="p-4 text-sm">{priceOrDash(ext.renew3YearPrice)}</td>
                  <td className="p-4 text-sm">{formatPrice(Number(ext.transferPrice))}</td>
                  <td className="p-4">
                    <button onClick={() => handleToggle(ext, "showInSuggestions")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${ext.showInSuggestions ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"}`}>
                      {ext.showInSuggestions ? <Eye size={11} /> : <EyeOff size={11} />}
                      {ext.showInSuggestions ? "Shown" : "Hidden"}
                    </button>
                  </td>
                  <td className="p-4">
                    <button onClick={() => handleToggle(ext, "privacyEnabled")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${ext.privacyEnabled ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"}`}>
                      {ext.privacyEnabled ? <Shield size={11} /> : <ShieldOff size={11} />}
                      {ext.privacyEnabled ? "Free" : "Off"}
                    </button>
                  </td>
                  <td className="p-4">
                    <button onClick={() => handleToggle(ext, "isFreeWithHosting")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${ext.isFreeWithHosting ? "bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"}`}>
                      <Globe size={11} />
                      {ext.isFreeWithHosting ? "Yes" : "No"}
                    </button>
                  </td>
                  <td className="p-4">
                    <button onClick={() => handleToggle(ext, "transferAllowed")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${ext.transferAllowed ? "bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20" : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"}`}>
                      <ArrowLeftRight size={11} />
                      {ext.transferAllowed ? "Allowed" : "Blocked"}
                    </button>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                      ext.status === "active" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-secondary text-muted-foreground border-border"
                    }`}>{ext.status}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleToggle(ext, "status")}>
                        {ext.status === "active" ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} className="text-muted-foreground" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEdit(ext)}>
                        <Pencil size={15} className="text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleDelete(ext.id)}>
                        <Trash2 size={15} className="text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Promo Banner Editor */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #701AFE 0%, #9B51E0 60%, #C084FC 100%)" }}>
            <Sparkles size={15} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Domain Search Promo Banner</h3>
            <p className="text-xs text-muted-foreground">Edit the special deal banner shown on the client domain search page</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-muted-foreground">Enabled</span>
              <button
                onClick={() => setPromo({ enabled: !promo.enabled })}
                className={`relative w-10 h-5 rounded-full transition-colors ${promo.enabled ? "bg-primary" : "bg-secondary"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${promo.enabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </label>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Banner Text</label>
            <Input
              value={promo.text}
              onChange={e => setPromo({ text: e.target.value })}
              placeholder="Special deal — Get a .com domain for Rs. 99/1st year..."
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Deal TLD (e.g. .com)</label>
            <Input
              value={promo.tld}
              onChange={e => setPromo({ tld: e.target.value })}
              placeholder=".com"
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Required Years</label>
            <Input
              type="number"
              value={promo.years}
              onChange={e => setPromo({ years: parseInt(e.target.value) || 3 })}
              min={1} max={10}
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Deal Price (PKR, 1st year)</label>
            <Input
              type="number"
              value={promo.price}
              onChange={e => setPromo({ price: parseFloat(e.target.value) || 0 })}
              placeholder="99"
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Original Price (PKR, for strikethrough)</label>
            <Input
              type="number"
              value={promo.originalPrice}
              onChange={e => setPromo({ originalPrice: parseFloat(e.target.value) || 0 })}
              placeholder="3000"
              className="text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 mb-4 leading-relaxed">
              <strong>Preview:</strong>{" "}
              {promo.enabled
                ? <>✅ Banner active — <span className="line-through opacity-60">PKR {promo.originalPrice}</span> → PKR {promo.price}/1st yr for {promo.tld} ({promo.years}yr)</>
                : "❌ Banner disabled — not shown to clients"}
            </div>
            <Button
              onClick={savePromo}
              disabled={savingPromo}
              className="gap-2"
              style={{ background: "linear-gradient(135deg, #701AFE 0%, #9B51E0 60%, #C084FC 100%)", border: "none" }}
            >
              {savingPromo ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Promo Banner
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
