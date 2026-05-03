import { useState, useEffect, useCallback } from "react";
import {
  Home, Info, DollarSign, FileText, Eye, EyeOff,
  Save, RefreshCw, Search, Shield, ChevronRight,
  Type, AlignLeft, Tag, Globe, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

// ─── Shared UI helpers ────────────────────────────────────────────────────────
const inputCls =
  "w-full px-4 py-2.5 rounded-xl text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:ring-2 focus:ring-primary/30 bg-secondary/60 border border-border/60 focus:border-primary/40";

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest mb-1.5 text-primary/70">
        {icon}<span>{label}</span>
      </label>
      {children}
    </div>
  );
}
function Inp({ value, onChange, placeholder = "", type = "text" }: any) {
  return <input type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder} className={inputCls} />;
}
function Txtarea({ value, onChange, placeholder = "", rows = 4 }: any) {
  return <textarea value={value ?? ""} onChange={onChange} placeholder={placeholder} rows={rows} className={`${inputCls} resize-y font-mono text-xs leading-relaxed`} />;
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
      <span className={`text-sm font-medium transition-colors ${checked ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </label>
  );
}

// ─── Page definitions ─────────────────────────────────────────────────────────
const PAGES = [
  { id: "home",    label: "Home",          icon: Home,     color: "text-blue-400",   bg: "bg-blue-500/10" },
  { id: "about",   label: "About",         icon: Info,     color: "text-emerald-400",bg: "bg-emerald-500/10" },
  { id: "pricing", label: "Pricing",       icon: DollarSign, color: "text-amber-400",  bg: "bg-amber-500/10" },
  { id: "terms",   label: "Terms",         icon: FileText, color: "text-rose-400",   bg: "bg-rose-500/10" },
  { id: "privacy", label: "Privacy",       icon: Shield,   color: "text-violet-400", bg: "bg-violet-500/10" },
];

// Per-page section definitions: id, label, icon, fields editor component
const SECTION_META: Record<string, {
  id: string; label: string; icon: React.ReactNode;
  editor: (content: any, onChange: (c: any) => void) => React.ReactNode;
}[]> = {
  home: [
    {
      id: "meta", label: "SEO Meta Tags", icon: <Tag size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Page Title" icon={<Type size={11} />}><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Noehost — Next-Gen Web Hosting" /></Field>
          <Field label="Meta Description" icon={<AlignLeft size={11} />}><Txtarea value={c.description} onChange={(e: any) => set({ ...c, description: e.target.value })} rows={3} placeholder="Short SEO description..." /></Field>
          <Field label="Keywords" icon={<Search size={11} />}><Inp value={c.keywords} onChange={(e: any) => set({ ...c, keywords: e.target.value })} placeholder="web hosting, vps, domains..." /></Field>
        </div>
      ),
    },
    {
      id: "hero", label: "Hero Banner", icon: <Home size={13} />,
      editor: (_c, _set) => (
        <div className="rounded-xl bg-secondary/30 border border-border/40 p-4">
          <p className="text-sm text-muted-foreground">Hero banner content is managed in the <span className="text-primary font-semibold">Hero</span> tab of Website Admin. Toggle visibility below to show/hide this section on the page.</p>
        </div>
      ),
    },
    {
      id: "services", label: "Services Section", icon: <Globe size={13} />,
      editor: (_c, _set) => (
        <div className="rounded-xl bg-secondary/30 border border-border/40 p-4">
          <p className="text-sm text-muted-foreground">Services content is managed in the <span className="text-primary font-semibold">Services</span> tab of Website Admin. Toggle visibility below.</p>
        </div>
      ),
    },
    {
      id: "features", label: "Features Section", icon: <CheckCircle2 size={13} />,
      editor: (_c, _set) => (
        <div className="rounded-xl bg-secondary/30 border border-border/40 p-4">
          <p className="text-sm text-muted-foreground">Features section visibility toggle. Content is rendered from built-in components.</p>
        </div>
      ),
    },
    {
      id: "pricing", label: "Pricing Section", icon: <DollarSign size={13} />,
      editor: (_c, _set) => (
        <div className="rounded-xl bg-secondary/30 border border-border/40 p-4">
          <p className="text-sm text-muted-foreground">Pricing plans are managed in the <span className="text-primary font-semibold">Pricing</span> tab of Website Admin. Toggle to show/hide on home page.</p>
        </div>
      ),
    },
    {
      id: "faq", label: "FAQ Section", icon: <AlertCircle size={13} />,
      editor: (_c, _set) => (
        <div className="rounded-xl bg-secondary/30 border border-border/40 p-4">
          <p className="text-sm text-muted-foreground">FAQ content is managed in the <span className="text-primary font-semibold">FAQ</span> tab of Website Admin. Toggle visibility below.</p>
        </div>
      ),
    },
    {
      id: "testimonials", label: "Testimonials", icon: <CheckCircle2 size={13} />,
      editor: (_c, _set) => (
        <div className="rounded-xl bg-secondary/30 border border-border/40 p-4">
          <p className="text-sm text-muted-foreground">Testimonials section visibility toggle. Use the toggle below to show or hide this section.</p>
        </div>
      ),
    },
  ],
  about: [
    {
      id: "meta", label: "SEO Meta Tags", icon: <Tag size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Page Title"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="About Us — Noehost" /></Field>
          <Field label="Meta Description"><Txtarea value={c.description} onChange={(e: any) => set({ ...c, description: e.target.value })} rows={3} /></Field>
          <Field label="Keywords"><Inp value={c.keywords} onChange={(e: any) => set({ ...c, keywords: e.target.value })} /></Field>
        </div>
      ),
    },
    {
      id: "hero", label: "Page Hero", icon: <Home size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Badge Text"><Inp value={c.badge} onChange={(e: any) => set({ ...c, badge: e.target.value })} placeholder="Our Story" /></Field>
          <Field label="Heading"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="About Noehost" /></Field>
          <Field label="Subtitle"><Txtarea value={c.subtitle} onChange={(e: any) => set({ ...c, subtitle: e.target.value })} rows={3} /></Field>
        </div>
      ),
    },
    {
      id: "mission", label: "Mission Statement", icon: <Globe size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Title"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Our Mission" /></Field>
          <Field label="Description"><Txtarea value={c.description} onChange={(e: any) => set({ ...c, description: e.target.value })} rows={4} /></Field>
        </div>
      ),
    },
    {
      id: "values", label: "Core Values", icon: <CheckCircle2 size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Section Title"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Our Values" /></Field>
          <Field label="Values (JSON array)">
            <Txtarea
              value={JSON.stringify(c.items ?? [], null, 2)}
              onChange={(e: any) => {
                try { set({ ...c, items: JSON.parse(e.target.value) }); } catch {}
              }}
              rows={8}
              placeholder={`[{ "title": "Reliability", "description": "..." }]`}
            />
          </Field>
        </div>
      ),
    },
    {
      id: "team", label: "Team Section", icon: <Info size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Title"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="The Team" /></Field>
          <Field label="Description"><Txtarea value={c.description} onChange={(e: any) => set({ ...c, description: e.target.value })} rows={4} /></Field>
        </div>
      ),
    },
    {
      id: "contact", label: "Contact Info", icon: <Globe size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Section Title"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Get in Touch" /></Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Email"><Inp value={c.email} onChange={(e: any) => set({ ...c, email: e.target.value })} placeholder="support@noehost.com" /></Field>
            <Field label="Phone"><Inp value={c.phone} onChange={(e: any) => set({ ...c, phone: e.target.value })} placeholder="+92 300 0000000" /></Field>
            <Field label="Address"><Inp value={c.address} onChange={(e: any) => set({ ...c, address: e.target.value })} placeholder="Lahore, Pakistan" /></Field>
          </div>
        </div>
      ),
    },
  ],
  pricing: [
    {
      id: "meta", label: "SEO Meta Tags", icon: <Tag size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Page Title"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Hosting Plans & Pricing — Noehost" /></Field>
          <Field label="Meta Description"><Txtarea value={c.description} onChange={(e: any) => set({ ...c, description: e.target.value })} rows={3} /></Field>
          <Field label="Keywords"><Inp value={c.keywords} onChange={(e: any) => set({ ...c, keywords: e.target.value })} /></Field>
        </div>
      ),
    },
    {
      id: "header", label: "Page Header", icon: <Type size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Badge"><Inp value={c.badge} onChange={(e: any) => set({ ...c, badge: e.target.value })} placeholder="Best Value" /></Field>
          <Field label="Heading"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Choose Your Hosting Plan" /></Field>
          <Field label="Subtitle"><Txtarea value={c.subtitle} onChange={(e: any) => set({ ...c, subtitle: e.target.value })} rows={3} /></Field>
        </div>
      ),
    },
    {
      id: "cta", label: "CTA Banner", icon: <Globe size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="CTA Title"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} /></Field>
          <Field label="CTA Description"><Txtarea value={c.description} onChange={(e: any) => set({ ...c, description: e.target.value })} rows={3} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Button Text"><Inp value={c.buttonText} onChange={(e: any) => set({ ...c, buttonText: e.target.value })} /></Field>
            <Field label="Button Link"><Inp value={c.buttonHref} onChange={(e: any) => set({ ...c, buttonHref: e.target.value })} /></Field>
          </div>
        </div>
      ),
    },
  ],
  terms: [
    {
      id: "meta", label: "SEO Meta Tags", icon: <Tag size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Page Title"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} /></Field>
          <Field label="Meta Description"><Txtarea value={c.description} onChange={(e: any) => set({ ...c, description: e.target.value })} rows={3} /></Field>
          <Field label="Keywords"><Inp value={c.keywords} onChange={(e: any) => set({ ...c, keywords: e.target.value })} /></Field>
        </div>
      ),
    },
    {
      id: "header", label: "Page Header", icon: <Type size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Page Title"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Terms of Service" /></Field>
          <Field label="Last Updated"><Inp value={c.lastUpdated} onChange={(e: any) => set({ ...c, lastUpdated: e.target.value })} placeholder="27 March 2026" /></Field>
        </div>
      ),
    },
    {
      id: "content", label: "Page Content", icon: <AlignLeft size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">Supports Markdown headings (## Heading), bold (**text**), and plain paragraphs.</span>
          </div>
          <Field label="Content (Markdown)">
            <Txtarea value={c.body} onChange={(e: any) => set({ ...c, body: e.target.value })} rows={20} placeholder="## Section Title&#10;&#10;Your content here..." />
          </Field>
        </div>
      ),
    },
  ],
  privacy: [
    {
      id: "meta", label: "SEO Meta Tags", icon: <Tag size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Page Title"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} /></Field>
          <Field label="Meta Description"><Txtarea value={c.description} onChange={(e: any) => set({ ...c, description: e.target.value })} rows={3} /></Field>
          <Field label="Keywords"><Inp value={c.keywords} onChange={(e: any) => set({ ...c, keywords: e.target.value })} /></Field>
        </div>
      ),
    },
    {
      id: "header", label: "Page Header", icon: <Type size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Page Title"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Privacy Policy" /></Field>
          <Field label="Last Updated"><Inp value={c.lastUpdated} onChange={(e: any) => set({ ...c, lastUpdated: e.target.value })} placeholder="27 March 2026" /></Field>
        </div>
      ),
    },
    {
      id: "content", label: "Page Content", icon: <AlignLeft size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">Supports Markdown headings (## Heading), bold (**text**), and plain paragraphs.</span>
          </div>
          <Field label="Content (Markdown)">
            <Txtarea value={c.body} onChange={(e: any) => set({ ...c, body: e.target.value })} rows={20} placeholder="## Section Title&#10;&#10;Your content here..." />
          </Field>
        </div>
      ),
    },
  ],
};

// ─── Section Editor Panel ─────────────────────────────────────────────────────
function SectionEditor({
  pageId,
  sectionId,
  sectionMeta,
  sectionData,
  onSaved,
  token,
}: {
  pageId: string;
  sectionId: string;
  sectionMeta: (typeof SECTION_META)[string][number];
  sectionData: { content: any; isVisible: boolean } | null;
  onSaved: () => void;
  token: string | null;
}) {
  const [content, setContent] = useState<any>(sectionData?.content ?? {});
  const [isVisible, setIsVisible] = useState<boolean>(sectionData?.isVisible ?? true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (sectionData) {
      setContent(sectionData.content ?? {});
      setIsVisible(sectionData.isVisible ?? true);
    }
  }, [sectionData, sectionId, pageId]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pages/${pageId}/${sectionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content, isVisible }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
      onSaved();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-foreground">{sectionMeta.label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Edit content and save. Changes go live immediately.</p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full">
              <CheckCircle2 size={12} /> Saved!
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40 shadow-lg"
            style={{ background: "linear-gradient(135deg,#673de6,#8b5cf6)" }}
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Visibility toggle */}
      <div className="rounded-xl border border-border/50 bg-secondary/20 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isVisible ? <Eye size={14} className="text-emerald-400" /> : <EyeOff size={14} className="text-muted-foreground" />}
          <span className="text-sm font-semibold text-foreground">Section Visibility</span>
        </div>
        <Toggle
          checked={isVisible}
          onChange={setIsVisible}
          label={isVisible ? "Visible on website" : "Hidden from website"}
        />
      </div>

      {/* Content editor */}
      <div className="rounded-2xl border border-border/60 bg-secondary/20 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 bg-primary/5 flex items-center gap-2">
          <span className="text-muted-foreground">{sectionMeta.icon}</span>
          <span className="text-sm font-bold text-foreground">Content Editor</span>
        </div>
        <div className="p-5">
          {sectionMeta.editor(content, setContent)}
        </div>
      </div>
    </div>
  );
}

// ─── Page Tab ─────────────────────────────────────────────────────────────────
function PageTab({ pageId }: { pageId: string }) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const sections = SECTION_META[pageId] ?? [];

  const [pageData, setPageData] = useState<Record<string, { content: any; isVisible: boolean }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id ?? "meta");
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPageData(data.sections ?? {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pageId, token]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const currentSectionMeta = sections.find((s) => s.id === activeSection) ?? sections[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw size={20} className="animate-spin text-primary mr-3" />
        <span className="text-sm text-muted-foreground">Loading page data…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle size={24} className="text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <button onClick={fetchPage} className="text-xs text-primary hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="flex gap-5 min-h-[500px]">
      {/* Sidebar — section list */}
      <div className="w-52 shrink-0">
        <div className="rounded-2xl border border-border/60 bg-secondary/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-primary/5">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sections</p>
          </div>
          <div className="divide-y divide-border/30">
            {sections.map((s) => {
              const vis = pageData?.[s.id]?.isVisible ?? true;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all group ${
                    activeSection === s.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={activeSection === s.id ? "text-primary" : "text-muted-foreground"}>{s.icon}</span>
                    <span className="text-xs font-semibold truncate">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {!vis && <EyeOff size={10} className="text-muted-foreground/50" />}
                    {activeSection === s.id && <ChevronRight size={12} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Editor panel */}
      <div className="flex-1 min-w-0">
        {currentSectionMeta && (
          <SectionEditor
            key={`${pageId}-${activeSection}`}
            pageId={pageId}
            sectionId={activeSection}
            sectionMeta={currentSectionMeta}
            sectionData={pageData?.[activeSection] ?? null}
            onSaved={fetchPage}
            token={token}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main PageManager component ───────────────────────────────────────────────
export default function PageManager() {
  const [activePage, setActivePage] = useState<string>("home");
  const activeDef = PAGES.find((p) => p.id === activePage) ?? PAGES[0];

  return (
    <div className="space-y-6">
      {/* Page tabs */}
      <div className="rounded-2xl border border-border/60 bg-secondary/10 p-1.5 flex gap-1.5 flex-wrap">
        {PAGES.map((p) => {
          const Icon = p.icon;
          const active = activePage === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setActivePage(p.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                active
                  ? "text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground bg-transparent"
              }`}
              style={active ? { background: "linear-gradient(135deg,#673de6,#8b5cf6)" } : {}}
            >
              <Icon size={14} className={active ? "text-white" : p.color} />
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Active page info */}
      <div className={`rounded-xl ${activeDef.bg} border border-border/40 px-5 py-3 flex items-center gap-3`}>
        <activeDef.icon size={16} className={activeDef.color} />
        <div>
          <p className="text-sm font-bold text-foreground">{activeDef.label} Page</p>
          <p className="text-xs text-muted-foreground">Edit sections, toggle visibility, and manage SEO meta tags. All changes save to the database and go live immediately.</p>
        </div>
      </div>

      {/* Page editor */}
      <PageTab key={activePage} pageId={activePage} />
    </div>
  );
}
