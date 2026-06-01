import { useState, useEffect } from "react";
import {
  Globe, Home, Zap, Package, TrendingUp, MessageSquare, Star, Award,
  Settings, Shield, Layout, Layers, DollarSign, RefreshCw, Save,
  Plus, Trash2, ChevronDown, ChevronUp, Type, AlignLeft, Phone, Mail,
  FileText, Server, Cpu, Users, Bell, LayoutDashboard
} from "lucide-react";
import { MasterPage } from "@/components/layout/MasterPage";
import { useContent } from "@/context/ContentContext";
import { useAuth } from "@/hooks/use-auth";
import PageManager from "./PageManager";

// ─── Shared UI helpers ────────────────────────────────────────────────────────
const inputCls = "w-full px-4 py-2.5 rounded-xl text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:ring-2 focus:ring-primary/30 bg-secondary/60 border border-border/60 focus:border-primary/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-primary/70">{label}</label>
      {children}
    </div>
  );
}
function Inp({ value, onChange, placeholder = "", type = "text" }: any) {
  return <input type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder} className={inputCls} />;
}
function Txtarea({ value, onChange, placeholder = "", rows = 3 }: any) {
  return <textarea value={value ?? ""} onChange={onChange} placeholder={placeholder} rows={rows} className={inputCls} />;
}
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-all ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? "left-5" : "left-0.5"}`} />
      </button>
      <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
    </label>
  );
}
function SaveBar({ onSave, saving, saved }: { onSave: () => void; saving: boolean; saved: boolean }) {
  return (
    <div className="flex items-center gap-3 justify-end pt-4 border-t border-border/50">
      {saved && <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full">Saved!</span>}
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 shadow"
        style={{ background: "linear-gradient(135deg,#673de6,#8b5cf6)" }}
      >
        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/20 overflow-hidden">
      <div className="px-6 py-4 border-b border-border/40 bg-primary/5">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}
function ListEditor({ items, onChange, renderItem, newItem }: { items: any[]; onChange: (v: any[]) => void; renderItem: (item: any, idx: number, update: (v: any) => void, remove: () => void) => React.ReactNode; newItem: any }) {
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="relative rounded-xl p-4 bg-secondary/30 border border-border/40">
          {renderItem(item, idx, (val: any) => { const n = [...items]; n[idx] = { ...n[idx], ...val }; onChange(n); }, () => onChange(items.filter((_, k) => k !== idx)))}
        </div>
      ))}
      <button
        onClick={() => onChange([...items, newItem])}
        className="w-full py-3 rounded-xl text-sm font-bold text-primary hover:text-primary/80 flex items-center justify-center gap-2 border-2 border-dashed border-primary/25 bg-primary/3 transition-all"
      >
        <Plus size={15} /> Add Item
      </button>
    </div>
  );
}
function DelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="absolute top-3 right-3 p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-all">
      <Trash2 size={13} />
    </button>
  );
}

function useSave(key: string) {
  const { content, updateContent } = useContent();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (data: any) => {
    setSaving(true);
    try {
      await updateContent(key, data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (key === "pricing") {
        try { localStorage.setItem("noehost_pricing_updated", Date.now().toString()); } catch {}
      }
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      alert(`Failed to save: ${msg}\n\nPlease make sure you are logged in as admin and try again.`);
      console.error("[WebsiteMaster] Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return { content, save, saving, saved };
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

function HeroTab() {
  const { content, save, saving, saved } = useSave("hero");
  const [d, setD] = useState<any>(content?.hero || {});
  useEffect(() => { if (content?.hero) setD(content.hero); }, [content]);
  return (
    <div className="space-y-5">
      <Card title="Hero Banner">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Badge Text"><Inp value={d.badge} onChange={(e: any) => setD({ ...d, badge: e.target.value })} placeholder="Next-Gen Hosting Infrastructure" /></Field>
          <Field label="Main Title"><Inp value={d.title} onChange={(e: any) => setD({ ...d, title: e.target.value })} placeholder="Empower Your Digital Future" /></Field>
        </div>
        <Field label="Description"><Txtarea value={d.description} onChange={(e: any) => setD({ ...d, description: e.target.value })} placeholder="Description text..." /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Primary Button Text"><Inp value={d.ctaPrimary} onChange={(e: any) => setD({ ...d, ctaPrimary: e.target.value })} /></Field>
          <Field label="Primary Button Link"><Inp value={d.ctaPrimaryHref} onChange={(e: any) => setD({ ...d, ctaPrimaryHref: e.target.value })} /></Field>
        </div>
        <Field label="Key Features (one per line)">
          <Txtarea value={(d.features || []).join("\n")} onChange={(e: any) => setD({ ...d, features: e.target.value.split("\n").map((s: string) => s.trim()).filter(Boolean) })} rows={4} placeholder={"Free SSL\n24/7 Support"} />
        </Field>
        <SaveBar onSave={() => save(d)} saving={saving} saved={saved} />
      </Card>
    </div>
  );
}

function NavbarTab() {
  const { content, save, saving, saved } = useSave("navbar");
  const [d, setD] = useState<any>(content?.navbar || { logo: "NOEHOST", links: [] });
  useEffect(() => { if (content?.navbar) setD(content.navbar); }, [content]);
  return (
    <div className="space-y-5">
      <Card title="Navbar & Logo">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Logo Text (Fallback)"><Inp value={d.logo} onChange={(e: any) => setD({ ...d, logo: e.target.value })} placeholder="NOEHOST" /></Field>
          <Field label="Logo Image URL"><Inp value={d.logoUrl} onChange={(e: any) => setD({ ...d, logoUrl: e.target.value })} placeholder="https://..." /></Field>
        </div>
        <Field label="Navigation Links">
          <ListEditor
            items={d.links || []}
            onChange={(v) => setD({ ...d, links: v })}
            newItem={{ name: "", href: "" }}
            renderItem={(item, idx, update, remove) => (
              <div className="grid grid-cols-2 gap-3 pr-8">
                <DelBtn onClick={remove} />
                <Inp value={item.name} onChange={(e: any) => update({ name: e.target.value })} placeholder="Link Name" />
                <Inp value={item.href} onChange={(e: any) => update({ href: e.target.value })} placeholder="/page-url" />
              </div>
            )}
          />
        </Field>
        <SaveBar onSave={() => save(d)} saving={saving} saved={saved} />
      </Card>
    </div>
  );
}

function TopBarTab() {
  const { content, save, saving, saved } = useSave("config");
  const [d, setD] = useState<any>(content?.config?.topbar || { show: true, email: "support@noehost.com", phone: "", announcement: "" });
  useEffect(() => { if (content?.config?.topbar) setD(content.config.topbar); }, [content]);
  const doSave = () => save({ ...content?.config, topbar: d });
  return (
    <div className="space-y-5">
      <Card title="Top Announcement Bar">
        <Toggle checked={d.show} onChange={(v) => setD({ ...d, show: v })} label="Show Top Bar" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Support Email"><Inp value={d.email} onChange={(e: any) => setD({ ...d, email: e.target.value })} placeholder="support@noehost.com" /></Field>
          <Field label="Support Phone"><Inp value={d.phone} onChange={(e: any) => setD({ ...d, phone: e.target.value })} placeholder="+92 300 0000000" /></Field>
        </div>
        <Field label="Announcement Text"><Inp value={d.announcement} onChange={(e: any) => setD({ ...d, announcement: e.target.value })} placeholder="Flash Sale: 50% Off all Shared Plans!" /></Field>
        <SaveBar onSave={doSave} saving={saving} saved={saved} />
      </Card>
    </div>
  );
}

function ServicesTab() {
  const { content, save, saving, saved } = useSave("services");
  const [d, setD] = useState<any>(content?.services || { title: "", description: "", items: [] });
  useEffect(() => { if (content?.services) setD(content.services); }, [content]);
  return (
    <div className="space-y-5">
      <Card title="Services Section">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Section Title"><Inp value={d.title} onChange={(e: any) => setD({ ...d, title: e.target.value })} /></Field>
          <Field label="Section Description"><Inp value={d.description} onChange={(e: any) => setD({ ...d, description: e.target.value })} /></Field>
        </div>
        <Field label="Service Cards">
          <ListEditor
            items={d.items || []}
            onChange={(v) => setD({ ...d, items: v })}
            newItem={{ title: "", description: "" }}
            renderItem={(item, idx, update, remove) => (
              <div className="space-y-3 pr-8">
                <DelBtn onClick={remove} />
                <Inp value={item.title} onChange={(e: any) => update({ title: e.target.value })} placeholder="Service Title" />
                <Txtarea value={item.description} onChange={(e: any) => update({ description: e.target.value })} placeholder="Service Description" rows={2} />
              </div>
            )}
          />
        </Field>
        <SaveBar onSave={() => save(d)} saving={saving} saved={saved} />
      </Card>
    </div>
  );
}

function FAQTab() {
  const { content, save, saving, saved } = useSave("faq");
  const [d, setD] = useState<any>(content?.faq || { title: "", description: "", items: [] });
  useEffect(() => { if (content?.faq) setD(content.faq); }, [content]);
  return (
    <div className="space-y-5">
      <Card title="FAQ Section">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Section Title"><Inp value={d.title} onChange={(e: any) => setD({ ...d, title: e.target.value })} /></Field>
          <Field label="Section Description"><Inp value={d.description} onChange={(e: any) => setD({ ...d, description: e.target.value })} /></Field>
        </div>
        <Field label="FAQ Items">
          <ListEditor
            items={d.items || []}
            onChange={(v) => setD({ ...d, items: v })}
            newItem={{ question: "", answer: "" }}
            renderItem={(item, idx, update, remove) => (
              <div className="space-y-3 pr-8">
                <DelBtn onClick={remove} />
                <Inp value={item.question} onChange={(e: any) => update({ question: e.target.value })} placeholder="Question" />
                <Txtarea value={item.answer} onChange={(e: any) => update({ answer: e.target.value })} placeholder="Answer" rows={3} />
              </div>
            )}
          />
        </Field>
        <SaveBar onSave={() => save(d)} saving={saving} saved={saved} />
      </Card>
    </div>
  );
}

function FooterTab() {
  const { content, save, saving, saved } = useSave("footer");
  const [d, setD] = useState<any>(content?.footer || { about: "", contact: {}, social: {} });
  useEffect(() => { if (content?.footer) setD(content.footer); }, [content]);
  return (
    <div className="space-y-5">
      <Card title="Footer Content">
        <Field label="About / Tagline Text">
          <Txtarea value={d.about} onChange={(e: any) => setD({ ...d, about: e.target.value })} rows={3} />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Email"><Inp value={d.contact?.email} onChange={(e: any) => setD({ ...d, contact: { ...d.contact, email: e.target.value } })} placeholder="support@noehost.com" /></Field>
          <Field label="Phone"><Inp value={d.contact?.phone} onChange={(e: any) => setD({ ...d, contact: { ...d.contact, phone: e.target.value } })} placeholder="+92 300 0000000" /></Field>
          <Field label="Address"><Inp value={d.contact?.address} onChange={(e: any) => setD({ ...d, contact: { ...d.contact, address: e.target.value } })} /></Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Twitter / X"><Inp value={d.social?.twitter} onChange={(e: any) => setD({ ...d, social: { ...d.social, twitter: e.target.value } })} /></Field>
          <Field label="GitHub"><Inp value={d.social?.github} onChange={(e: any) => setD({ ...d, social: { ...d.social, github: e.target.value } })} /></Field>
          <Field label="LinkedIn"><Inp value={d.social?.linkedin} onChange={(e: any) => setD({ ...d, social: { ...d.social, linkedin: e.target.value } })} /></Field>
        </div>
        <SaveBar onSave={() => save(d)} saving={saving} saved={saved} />
      </Card>
    </div>
  );
}

function PricingTab() {
  const { content, save, saving, saved } = useSave("pricing");
  const DEF = {
    header: { title: "Choose your Web Hosting plan", subtitle: "All plans include a 30-day money-back guarantee." },
    shared: [
      { name: "Single", monthly: 1.99, yearly: 1.49, features: ["1 Website", "50GB SSD", "Free SSL"], popular: false },
      { name: "Premium", monthly: 2.99, yearly: 2.49, features: ["100 Websites", "100GB SSD", "Free SSL", "Free Domain"], popular: true },
    ],
    reseller: [],
  };
  const [d, setD] = useState<any>(content?.pricing || DEF);
  const [tab, setTab] = useState<"shared" | "reseller" | "header">("shared");
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { if (content?.pricing) setD(content.pricing); }, [content]);

  const updatePlan = (cat: string, idx: number, field: string, val: any) => {
    setD((p: any) => { const arr = [...(p[cat] || [])]; arr[idx] = { ...arr[idx], [field]: val }; return { ...p, [cat]: arr }; });
  };

  const TABS = [
    { key: "header", label: "Section Header" },
    { key: "shared", label: "Web Hosting Plans" },
    { key: "reseller", label: "Reseller Plans" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${tab === t.key ? "text-white" : "text-muted-foreground hover:text-foreground bg-secondary/50 border border-border/60"}`}
            style={tab === t.key ? { background: "linear-gradient(135deg,#673de6,#8b5cf6)" } : {}}>
            {t.label}
          </button>
        ))}
        <button onClick={() => save(d)} disabled={saving}
          className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40"
          style={{ background: "linear-gradient(135deg,#673de6,#8b5cf6)" }}>
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
          {saved ? "Saved!" : "Save All"}
        </button>
      </div>

      {tab === "header" && (
        <Card title="Section Header">
          <Field label="Title"><Inp value={d.header?.title} onChange={(e: any) => setD((p: any) => ({ ...p, header: { ...p.header, title: e.target.value } }))} /></Field>
          <Field label="Subtitle"><Txtarea value={d.header?.subtitle} onChange={(e: any) => setD((p: any) => ({ ...p, header: { ...p.header, subtitle: e.target.value } }))} rows={2} /></Field>
        </Card>
      )}

      {(tab === "shared" || tab === "reseller") && (
        <div className="space-y-3">
          {(d[tab] || []).map((plan: any, idx: number) => (
            <div key={idx} className="rounded-2xl border border-border/60 bg-secondary/20 overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-secondary/40 transition-colors"
                onClick={() => setOpen(open === idx ? null : idx)}>
                <span className="font-bold text-foreground text-sm">{plan.name || "Unnamed Plan"}</span>
                <div className="flex items-center gap-3">
                  {plan.popular && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase">Popular</span>}
                  <button onClick={e => { e.stopPropagation(); setD((p: any) => ({ ...p, [tab]: p[tab].filter((_: any, k: number) => k !== idx) })); }}
                    className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-all"><Trash2 size={13} /></button>
                  {open === idx ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
                </div>
              </div>
              {open === idx && (
                <div className="p-5 space-y-4 border-t border-border/40">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Plan Name"><Inp value={plan.name} onChange={(e: any) => updatePlan(tab, idx, "name", e.target.value)} /></Field>
                    <Field label="Badge"><Inp value={plan.badge || ""} onChange={(e: any) => updatePlan(tab, idx, "badge", e.target.value)} placeholder="+ 3 Months Free" /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Monthly Price">
                      <input type="number" step="0.01" min="0" value={plan.monthly ?? 0} onChange={(e) => updatePlan(tab, idx, "monthly", parseFloat(e.target.value) || 0)} className={inputCls} />
                    </Field>
                    <Field label="Yearly Price (per mo)">
                      <input type="number" step="0.01" min="0" value={plan.yearly ?? 0} onChange={(e) => updatePlan(tab, idx, "yearly", parseFloat(e.target.value) || 0)} className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Features (one per line)">
                    <Txtarea value={(plan.features || []).join("\n")} onChange={(e: any) => updatePlan(tab, idx, "features", e.target.value.split("\n").map((s: string) => s.trim()).filter(Boolean))} rows={4} placeholder={"Free SSL\nFree Domain"} />
                  </Field>
                  <Toggle checked={plan.popular} onChange={(v) => updatePlan(tab, idx, "popular", v)} label="Mark as Popular Plan" />
                </div>
              )}
            </div>
          ))}
          <button onClick={() => setD((p: any) => ({ ...p, [tab]: [...(p[tab] || []), { name: "New Plan", monthly: 4.99, yearly: 3.99, features: [], popular: false }] }))}
            className="w-full py-3 rounded-xl text-sm font-bold text-primary flex items-center justify-center gap-2 border-2 border-dashed border-primary/25 transition-all">
            <Plus size={15} /> Add Plan
          </button>
        </div>
      )}
    </div>
  );
}

function DomainPricingTab() {
  const { user } = useAuth();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("noehost_token") || "" : null;
  const [extensions, setExtensions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/domain-extensions", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json()).then(setExtensions).catch(() => setExtensions([])).finally(() => setLoading(false));
  }, []);

  const updateExt = async (id: string, field: string, val: number) => {
    const prev = extensions;
    setExtensions(e => e.map(x => x.id === id ? { ...x, [field]: val } : x));
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/domain-extensions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ [field]: val }),
      });
      if (!res.ok) throw new Error();
      setSaved(id);
      setTimeout(() => setSaved(null), 2000);
      try { localStorage.setItem("noehost_pricing_updated", Date.now().toString()); } catch {}
    } catch {
      setExtensions(prev);
      alert("Failed to update");
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="py-10 text-center text-muted-foreground text-sm">Loading domain extensions…</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-secondary/20 overflow-hidden">
        <div className="grid grid-cols-5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/40 bg-secondary/40">
          <div>Extension</div>
          <div>Register (PKR)</div>
          <div>Renew (PKR)</div>
          <div>Transfer (PKR)</div>
          <div>Free w/ Hosting</div>
        </div>
        <div className="divide-y divide-border/30">
          {extensions.map(ext => (
            <div key={ext.id} className="grid grid-cols-5 items-center px-4 py-2.5 hover:bg-secondary/30 transition-colors gap-2">
              <div className="font-bold text-sm text-foreground">{ext.extension}</div>
              {(["registerPrice", "renewalPrice", "transferPrice"] as const).map(field => (
                <input
                  key={field}
                  type="number"
                  min="0"
                  value={ext[field] ?? 0}
                  onBlur={(e) => { const v = parseFloat(e.target.value) || 0; if (v !== ext[field]) updateExt(ext.id, field, v); }}
                  onChange={(e) => setExtensions(exts => exts.map(x => x.id === ext.id ? { ...x, [field]: parseFloat(e.target.value) || 0 } : x))}
                  className="w-full px-3 py-1.5 rounded-lg text-sm bg-background border border-border/50 focus:border-primary/40 outline-none text-foreground"
                />
              ))}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={ext.isFreeWithHosting}
                  onChange={async (e) => updateExt(ext.id, "isFreeWithHosting", e.target.checked as any)}
                  className="w-4 h-4 accent-primary"
                />
                {saving === ext.id && <RefreshCw size={12} className="ml-2 animate-spin text-primary" />}
                {saved === ext.id && <span className="ml-2 text-[10px] text-emerald-400 font-bold">✓</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GlobalConfigTab() {
  const { content, save, saving, saved } = useSave("config");
  const [d, setD] = useState<any>(content?.config || {});
  useEffect(() => { if (content?.config) setD(content.config); }, [content]);
  return (
    <div className="space-y-5">
      <Card title="Site Identity">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Site Name"><Inp value={d.siteName} onChange={(e: any) => setD({ ...d, siteName: e.target.value })} placeholder="Noehost" /></Field>
          <Field label="Tagline"><Inp value={d.tagline} onChange={(e: any) => setD({ ...d, tagline: e.target.value })} placeholder="Powering the web..." /></Field>
        </div>
        <Field label="Meta Description"><Txtarea value={d.metaDescription} onChange={(e: any) => setD({ ...d, metaDescription: e.target.value })} rows={2} placeholder="SEO description" /></Field>
        <SaveBar onSave={() => save(d)} saving={saving} saved={saved} />
      </Card>
    </div>
  );
}

// ─── Master export ────────────────────────────────────────────────────────────
export default function WebsiteMaster() {
  return (
    <MasterPage
      title="Website"
      description="Manage all website content, pricing, domains, and configuration from one place."
      icon={Globe}
      defaultTab="hero"
      tabs={[
        { id: "hero",          label: "Hero",         icon: Home,       desc: "Main banner section",              component: HeroTab },
        { id: "navbar",        label: "Navbar",       icon: Layout,     desc: "Navigation links & logo",          component: NavbarTab },
        { id: "topbar",        label: "Top Bar",      icon: Bell,       desc: "Announcement bar",                 component: TopBarTab },
        { id: "services",      label: "Services",     icon: Package,    desc: "Services grid cards",              component: ServicesTab },
        { id: "faq",           label: "FAQ",          icon: MessageSquare, desc: "Frequently asked questions",   component: FAQTab },
        { id: "footer",        label: "Footer",       icon: Shield,     desc: "Footer & contact info",            component: FooterTab },
        { id: "pricing",       label: "Pricing",      icon: DollarSign, desc: "Hosting plans & prices",          component: PricingTab },
        { id: "domains",       label: "Domain Prices",icon: Globe,      desc: "TLD register/renew pricing (PKR)", component: DomainPricingTab },
        { id: "config",        label: "Global Config",icon: Settings,      desc: "Site name, tagline, meta",         component: GlobalConfigTab },
        { id: "pages",         label: "Page Manager", icon: LayoutDashboard, desc: "Edit pages, sections, SEO & visibility", component: PageManager },
      ]}
    />
  );
}
