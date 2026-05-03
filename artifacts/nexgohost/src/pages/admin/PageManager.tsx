import { useState, useEffect, useCallback } from "react";
import {
  Home, Info, Server, Globe, Mail, FileText, Shield, RefreshCw,
  Save, CheckCircle2, AlertCircle, ChevronRight,
  Type, AlignLeft, Tag, Users, List, Cpu, Layout,
} from "lucide-react";

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
function Inp({ value, onChange, placeholder = "" }: any) {
  return <input value={value ?? ""} onChange={onChange} placeholder={placeholder} className={inputCls} />;
}
function Txtarea({ value, onChange, placeholder = "", rows = 4 }: any) {
  return <textarea value={value ?? ""} onChange={onChange} placeholder={placeholder} rows={rows} className={`${inputCls} resize-y font-mono text-xs leading-relaxed`} />;
}

function JsonEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const [raw, setRaw] = useState(() => JSON.stringify(value ?? [], null, 2));
  const [err, setErr] = useState(false);
  useEffect(() => { setRaw(JSON.stringify(value ?? [], null, 2)); }, [JSON.stringify(value)]);
  return (
    <div>
      <Txtarea value={raw} onChange={(e: any) => {
        setRaw(e.target.value);
        try { onChange(JSON.parse(e.target.value)); setErr(false); } catch { setErr(true); }
      }} rows={8} />
      {err && <p className="text-xs text-destructive mt-1 font-medium">⚠ Invalid JSON — fix before saving.</p>}
    </div>
  );
}

// ─── Page + section definitions ───────────────────────────────────────────────
type SectionDef = {
  key: string;
  label: string;
  icon: React.ReactNode;
  isRoot?: boolean;
  editor: (data: any, set: (d: any) => void) => React.ReactNode;
};

const PAGES = [
  { id: "about",            label: "About",      icon: Info,     color: "text-emerald-400", bg: "bg-emerald-500/10", cmsDot: "pages.about" },
  { id: "contact",          label: "Contact",    icon: Mail,     color: "text-sky-400",     bg: "bg-sky-500/10",     cmsDot: "pages.contact" },
  { id: "sharedHosting",    label: "Shared",     icon: Server,   color: "text-blue-400",    bg: "bg-blue-500/10",    cmsDot: "pages.sharedHosting" },
  { id: "wordpressHosting", label: "WordPress",  icon: Layout,   color: "text-indigo-400",  bg: "bg-indigo-500/10",  cmsDot: "pages.wordpressHosting" },
  { id: "resellerHosting",  label: "Reseller",   icon: Users,    color: "text-violet-400",  bg: "bg-violet-500/10",  cmsDot: "pages.resellerHosting" },
  { id: "vpsHosting",       label: "VPS",        icon: Cpu,      color: "text-rose-400",    bg: "bg-rose-500/10",    cmsDot: "pages.vpsHosting" },
  { id: "domains",          label: "Domains",    icon: Globe,    color: "text-cyan-400",    bg: "bg-cyan-500/10",    cmsDot: "pages.domains" },
  { id: "terms",            label: "Terms",      icon: FileText, color: "text-amber-400",   bg: "bg-amber-500/10",   cmsDot: "pages.terms" },
  { id: "privacy",          label: "Privacy",    icon: Shield,   color: "text-teal-400",    bg: "bg-teal-500/10",    cmsDot: "pages.privacy" },
];

// Shared hero editor
function heroEditor(c: any, set: (d: any) => void) {
  return (
    <div className="space-y-4">
      <Field label="Badge Text" icon={<Tag size={11} />}>
        <Inp value={c.badge} onChange={(e: any) => set({ ...c, badge: e.target.value })} placeholder="Our Story" />
      </Field>
      <Field label="Main Heading" icon={<Type size={11} />}>
        <Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Main heading" />
      </Field>
      <Field label="Heading Highlight (coloured text)" icon={<Type size={11} />}>
        <Inp value={c.titleHighlight} onChange={(e: any) => set({ ...c, titleHighlight: e.target.value })} placeholder="Highlighted portion" />
      </Field>
      <Field label="Description" icon={<AlignLeft size={11} />}>
        <Txtarea value={c.description} onChange={(e: any) => set({ ...c, description: e.target.value })} rows={3} placeholder="Subtitle / description text" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Primary Button Text">
          <Inp value={c.primaryBtn?.text} onChange={(e: any) => set({ ...c, primaryBtn: { ...(c.primaryBtn || {}), text: e.target.value } })} placeholder="Get Started" />
        </Field>
        <Field label="Primary Button URL">
          <Inp value={c.primaryBtn?.url} onChange={(e: any) => set({ ...c, primaryBtn: { ...(c.primaryBtn || {}), url: e.target.value } })} placeholder="/register" />
        </Field>
      </div>
    </div>
  );
}

function jsonNote(schema: string) {
  return <p className="text-xs text-muted-foreground bg-secondary/40 px-3 py-2 rounded-lg mb-3">{schema}</p>;
}

const SECTION_DEFS: Record<string, SectionDef[]> = {

  // ─── About ──────────────────────────────────────────────────────────────────
  about: [
    { key: "hero", label: "Hero Banner", icon: <Home size={13} />, editor: heroEditor },
    {
      key: "stats", label: "Stats Row", icon: <List size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "value": "99.9%", "label": "Uptime SLA" } objects.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
    {
      key: "values", label: "Core Values", icon: <CheckCircle2 size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "title": "Reliability", "desc": "99.9% uptime..." } objects.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
    {
      key: "milestones", label: "Milestones", icon: <List size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "year": "2019", "title": "Founded", "desc": "..." } objects.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
    {
      key: "team", label: "Team Members", icon: <Users size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "name": "Alex Johnson", "role": "CEO", "bio": "..." } objects.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
    {
      key: "_teamMeta", label: "Team Section Text", icon: <Type size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Section Title">
            <Inp value={c.teamTitle} onChange={(e: any) => set({ ...c, teamTitle: e.target.value })} placeholder="The Team Behind Noehost" />
          </Field>
          <Field label="Section Description">
            <Txtarea value={c.teamDesc} onChange={(e: any) => set({ ...c, teamDesc: e.target.value })} rows={3} />
          </Field>
        </div>
      ),
    },
    {
      key: "_cta", label: "Call to Action", icon: <Tag size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Heading">
            <Inp value={c.ctaTitle} onChange={(e: any) => set({ ...c, ctaTitle: e.target.value })} placeholder="Ready to Experience Noehost?" />
          </Field>
          <Field label="Description">
            <Txtarea value={c.ctaDesc} onChange={(e: any) => set({ ...c, ctaDesc: e.target.value })} rows={2} />
          </Field>
          <Field label="Button Text">
            <Inp value={c.ctaBtnText} onChange={(e: any) => set({ ...c, ctaBtnText: e.target.value })} placeholder="Get Started Today" />
          </Field>
          <Field label="Button URL">
            <Inp value={c.ctaBtnUrl} onChange={(e: any) => set({ ...c, ctaBtnUrl: e.target.value })} placeholder="/register" />
          </Field>
        </div>
      ),
    },
  ],

  // ─── Contact ─────────────────────────────────────────────────────────────────
  contact: [
    { key: "hero", label: "Hero Banner", icon: <Home size={13} />, editor: heroEditor },
    {
      key: "channels", label: "Support Channels", icon: <Mail size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "type": "Live Chat", "desc": "24/7 instant support...", "action": "Start Chat", "url": "#" }. The "type" field is the card title.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
    {
      key: "offices", label: "Office Locations", icon: <Globe size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "city": "Karachi", "country": "Pakistan", "address": "...", "phone": "...", "email": "...", "primary": true }. Set primary:true for HQ.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
    {
      key: "faqs", label: "FAQ Items", icon: <List size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "q": "Question?", "a": "Answer..." } objects.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
    {
      key: "_faqMeta", label: "FAQ Section Title", icon: <Type size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="FAQ Section Title">
            <Inp value={c.faqTitle} onChange={(e: any) => set({ ...c, faqTitle: e.target.value })} placeholder="Frequently Asked Questions" />
          </Field>
        </div>
      ),
    },
  ],

  // ─── Shared Hosting ──────────────────────────────────────────────────────────
  sharedHosting: [
    { key: "hero", label: "Hero Banner", icon: <Home size={13} />, editor: heroEditor },
    {
      key: "_plansText", label: "Plans Section Text", icon: <Type size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Plans Section Title">
            <Inp value={c.plansTitle} onChange={(e: any) => set({ ...c, plansTitle: e.target.value })} placeholder="Simple, Transparent Pricing" />
          </Field>
          <Field label="Plans Subtitle">
            <Inp value={c.plansSubtitle} onChange={(e: any) => set({ ...c, plansSubtitle: e.target.value })} placeholder="No hidden fees. Cancel anytime." />
          </Field>
          <p className="text-xs text-muted-foreground bg-secondary/40 px-3 py-2 rounded-lg">
            Pricing plans themselves are managed under <span className="text-primary font-semibold">Admin → Packages</span>.
          </p>
        </div>
      ),
    },
    {
      key: "_featuresText", label: "Features Section Text", icon: <Type size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Features Section Title">
            <Inp value={c.featuresTitle} onChange={(e: any) => set({ ...c, featuresTitle: e.target.value })} placeholder="Built for Your Success" />
          </Field>
          <Field label="Features Description">
            <Txtarea value={c.featuresDesc} onChange={(e: any) => set({ ...c, featuresDesc: e.target.value })} rows={2} />
          </Field>
        </div>
      ),
    },
    {
      key: "features", label: "Feature Cards", icon: <List size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "title": "Free SSL Certificate", "desc": "Every domain gets..." }. Recognized icon titles: "cPanel Control Panel", "1-Click App Installer", "Free SSL Certificate", "Professional Email", "Daily Backups", "24/7 Expert Support".')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
    {
      key: "_faqMeta", label: "FAQ Section Title", icon: <Type size={13} />, isRoot: true,
      editor: (c, set) => (
        <Field label="FAQ Section Title">
          <Inp value={c.faqTitle} onChange={(e: any) => set({ ...c, faqTitle: e.target.value })} placeholder="Frequently Asked Questions" />
        </Field>
      ),
    },
    {
      key: "faqs", label: "FAQ Items", icon: <List size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "q": "Question?", "a": "Answer..." } objects.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
  ],

  // ─── WordPress Hosting ───────────────────────────────────────────────────────
  wordpressHosting: [
    { key: "hero", label: "Hero Banner", icon: <Home size={13} />, editor: heroEditor },
    {
      key: "features", label: "Feature Cards", icon: <List size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "title": "Feature Name", "desc": "Description..." } objects.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
    {
      key: "faqs", label: "FAQ Items", icon: <List size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "q": "Question?", "a": "Answer..." } objects.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
  ],

  // ─── Reseller Hosting ────────────────────────────────────────────────────────
  resellerHosting: [
    { key: "hero", label: "Hero Banner", icon: <Home size={13} />, editor: heroEditor },
    {
      key: "_stepsText", label: "Steps Section Text", icon: <Type size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Steps Section Title">
            <Inp value={c.stepsTitle} onChange={(e: any) => set({ ...c, stepsTitle: e.target.value })} placeholder="Start Your Hosting Business in 3 Steps" />
          </Field>
          <Field label="Steps Description">
            <Txtarea value={c.stepsDesc} onChange={(e: any) => set({ ...c, stepsDesc: e.target.value })} rows={2} />
          </Field>
        </div>
      ),
    },
    {
      key: "features", label: "Feature Cards", icon: <List size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "title": "WHM Control Panel", "desc": "Description..." } objects.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
    {
      key: "faqs", label: "FAQ Items", icon: <List size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "q": "Question?", "a": "Answer..." } objects.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
    {
      key: "_cta", label: "Call to Action", icon: <Tag size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="CTA Heading">
            <Inp value={c.ctaTitle} onChange={(e: any) => set({ ...c, ctaTitle: e.target.value })} placeholder="Ready to Start Your Hosting Business?" />
          </Field>
          <Field label="CTA Description">
            <Txtarea value={c.ctaDesc} onChange={(e: any) => set({ ...c, ctaDesc: e.target.value })} rows={2} />
          </Field>
          <Field label="Button Text">
            <Inp value={c.ctaBtnText} onChange={(e: any) => set({ ...c, ctaBtnText: e.target.value })} placeholder="Start Reselling Today" />
          </Field>
          <Field label="Button URL">
            <Inp value={c.ctaBtnUrl} onChange={(e: any) => set({ ...c, ctaBtnUrl: e.target.value })} placeholder="/register" />
          </Field>
        </div>
      ),
    },
  ],

  // ─── VPS Hosting ─────────────────────────────────────────────────────────────
  vpsHosting: [
    { key: "hero", label: "Hero Banner", icon: <Home size={13} />, editor: heroEditor },
    {
      key: "useCases", label: "Use Cases", icon: <List size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "title": "High-Traffic Websites", "desc": "Dedicated resources..." } objects.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
    {
      key: "securityItems", label: "Security Features", icon: <Shield size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "title": "DDoS Mitigation", "desc": "Up to 400 Gbps..." } objects.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
    {
      key: "datacenters", label: "Data Centers", icon: <Globe size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "city": "Karachi", "region": "South Asia", "ping": "8ms" } objects.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
    {
      key: "_migrationText", label: "Migration Section", icon: <Type size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Migration Section Title">
            <Inp value={c.migrationTitle} onChange={(e: any) => set({ ...c, migrationTitle: e.target.value })} placeholder="Free Migration to Noehost VPS" />
          </Field>
          <Field label="Migration Description">
            <Txtarea value={c.migrationDesc} onChange={(e: any) => set({ ...c, migrationDesc: e.target.value })} rows={3} />
          </Field>
          <Field label="Button Text">
            <Inp value={c.migrationBtnText} onChange={(e: any) => set({ ...c, migrationBtnText: e.target.value })} placeholder="Request Free Migration" />
          </Field>
          <Field label="Button URL">
            <Inp value={c.migrationBtnUrl} onChange={(e: any) => set({ ...c, migrationBtnUrl: e.target.value })} placeholder="/contact-us" />
          </Field>
        </div>
      ),
    },
  ],

  // ─── Domains ─────────────────────────────────────────────────────────────────
  domains: [
    {
      key: "hero", label: "Hero Banner", icon: <Home size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground bg-secondary/40 px-3 py-2 rounded-lg">
            The domain search bar and TLD pricing table are pulled from <span className="text-primary font-semibold">Admin → Domain Extensions</span>. Edit TLD prices there.
          </p>
          <Field label="Badge Text">
            <Inp value={c.badge} onChange={(e: any) => set({ ...c, badge: e.target.value })} placeholder="Domain Registration" />
          </Field>
          <Field label="Main Heading">
            <Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Find Your Perfect" />
          </Field>
          <Field label="Heading Highlight (coloured)">
            <Inp value={c.titleHighlight} onChange={(e: any) => set({ ...c, titleHighlight: e.target.value })} placeholder="Domain Name." />
          </Field>
          <Field label="Description">
            <Txtarea value={c.description} onChange={(e: any) => set({ ...c, description: e.target.value })} rows={3} />
          </Field>
        </div>
      ),
    },
  ],

  // ─── Terms ───────────────────────────────────────────────────────────────────
  terms: [
    {
      key: "_pageInfo", label: "Page Header", icon: <FileText size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Page Title">
            <Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Terms & Conditions" />
          </Field>
          <Field label="Last Updated Date">
            <Inp value={c.lastUpdated} onChange={(e: any) => set({ ...c, lastUpdated: e.target.value })} placeholder="January 15, 2025" />
          </Field>
          <Field label="Intro Paragraph">
            <Txtarea value={c.intro} onChange={(e: any) => set({ ...c, intro: e.target.value })} rows={3} placeholder="Brief introductory text shown at the top..." />
          </Field>
        </div>
      ),
    },
    {
      key: "sections", label: "T&C Sections", icon: <List size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "title": "1. Account Responsibility", "content": "You are responsible for..." }. Each renders as an expandable accordion.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
  ],

  // ─── Privacy ─────────────────────────────────────────────────────────────────
  privacy: [
    {
      key: "_pageInfo", label: "Page Header", icon: <Shield size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Page Title">
            <Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Privacy Policy" />
          </Field>
          <Field label="Last Updated Date">
            <Inp value={c.lastUpdated} onChange={(e: any) => set({ ...c, lastUpdated: e.target.value })} placeholder="January 15, 2025" />
          </Field>
          <Field label="Intro Paragraph">
            <Txtarea value={c.intro} onChange={(e: any) => set({ ...c, intro: e.target.value })} rows={3} />
          </Field>
        </div>
      ),
    },
    {
      key: "sections", label: "Policy Sections", icon: <List size={13} />,
      editor: (c, set) => (
        <>
          {jsonNote('Array of { "title": "1. Information We Collect", "content": "Account info, payment info..." }. Each renders as an expandable accordion.')}
          <JsonEditor value={c} onChange={set} />
        </>
      ),
    },
  ],
};

// ─── Section Editor ───────────────────────────────────────────────────────────
function SectionEditor({
  cmsDot, sectionDef, allPageData, onSaved, token,
}: {
  cmsDot: string;
  sectionDef: SectionDef;
  allPageData: any;
  onSaved: () => void;
  token: string | null;
}) {
  const getInitial = () =>
    sectionDef.isRoot ? (allPageData ?? {}) : (allPageData?.[sectionDef.key] ?? []);

  const [localData, setLocalData] = useState<any>(getInitial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    setLocalData(getInitial());
    setSavedAt(null);
  }, [sectionDef.key, JSON.stringify(allPageData)]);

  const save = async () => {
    setSaving(true);
    try {
      const updatedPage = sectionDef.isRoot
        ? { ...allPageData, ...localData }
        : { ...allPageData, [sectionDef.key]: localData };

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers,
        body: JSON.stringify({ key: cmsDot, value: updatedPage }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setSavedAt(new Date());
      try { localStorage.setItem("noehost_content_updated", Date.now().toString()); } catch {}
      onSaved();
    } catch (err) {
      console.error("[PageManager] save error:", err);
      alert("Save failed — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{sectionDef.icon}</span>
            <h3 className="text-base font-bold text-foreground">{sectionDef.label}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Changes are saved to the database and go live immediately.
          </p>
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

      <div className="rounded-2xl border border-border/60 bg-secondary/20 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 bg-primary/5 flex items-center gap-2">
          <span className="text-muted-foreground">{sectionDef.icon}</span>
          <span className="text-sm font-bold text-foreground">Content Editor — {sectionDef.label}</span>
        </div>
        <div className="p-5">
          {sectionDef.editor(localData, setLocalData)}
        </div>
      </div>
    </div>
  );
}

// ─── Page Tab ─────────────────────────────────────────────────────────────────
function PageTab({ pageId, cmsDot }: { pageId: string; cmsDot: string }) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const sections = SECTION_DEFS[pageId] ?? [];

  const [allPageData, setAllPageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.key ?? "hero");
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/content", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const all = await res.json();
      setAllPageData(all[cmsDot] ?? {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [cmsDot]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const currentSectionDef = sections.find((s) => s.key === activeSection) ?? sections[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw size={20} className="animate-spin text-primary mr-3" />
        <span className="text-sm text-muted-foreground">Loading page content…</span>
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
  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Info size={24} className="text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No editable sections defined for this page yet.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-5 min-h-[500px]">
      {/* Section sidebar */}
      <div className="w-52 shrink-0">
        <div className="rounded-2xl border border-border/60 bg-secondary/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-primary/5">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sections</p>
          </div>
          <div className="divide-y divide-border/30">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all ${
                  activeSection === s.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={activeSection === s.key ? "text-primary" : "text-muted-foreground"}>{s.icon}</span>
                  <span className="text-xs font-semibold truncate">{s.label}</span>
                </div>
                {activeSection === s.key && <ChevronRight size={12} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Editor panel */}
      <div className="flex-1 min-w-0">
        {currentSectionDef && (
          <SectionEditor
            key={`${pageId}-${activeSection}`}
            cmsDot={cmsDot}
            sectionDef={currentSectionDef}
            allPageData={allPageData}
            onSaved={fetchPage}
            token={token}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main PageManager ─────────────────────────────────────────────────────────
export default function PageManager() {
  const [activePage, setActivePage] = useState<string>("about");
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
                active ? "text-white shadow-lg" : "text-muted-foreground hover:text-foreground"
              }`}
              style={active ? { background: "linear-gradient(135deg,#673de6,#8b5cf6)" } : {}}
            >
              <Icon size={14} className={active ? "text-white" : p.color} />
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Active page info bar */}
      {activeDef && (
        <div className={`rounded-xl ${activeDef.bg} border border-border/40 px-5 py-3 flex items-center gap-3`}>
          <activeDef.icon size={16} className={activeDef.color} />
          <div>
            <p className="text-sm font-bold text-foreground">{activeDef.label} Page</p>
            <p className="text-xs text-muted-foreground">
              Edit content below — saved directly to the database and shown live on your website immediately.
            </p>
          </div>
        </div>
      )}

      {/* Page tab content */}
      <PageTab key={activePage} pageId={activePage} cmsDot={activeDef?.cmsDot ?? ""} />
    </div>
  );
}
