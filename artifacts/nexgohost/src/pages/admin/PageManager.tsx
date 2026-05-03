import { useState, useEffect, useCallback } from "react";
import {
  Home, Info, Server, Globe, Mail, FileText, Shield, RefreshCw,
  Save, CheckCircle2, AlertCircle, ChevronRight, ExternalLink,
  Type, AlignLeft, Tag, Users, List, Cpu, Layout, Plus, X,
  Monitor, Phone, AtSign, Megaphone, Eye, Trash2, Navigation,
  Image, Link2, ToggleLeft,
} from "lucide-react";

// ─── Shared UI helpers ─────────────────────────────────────────────────────────
const inputCls =
  "w-full px-4 py-2.5 rounded-xl text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:ring-2 focus:ring-primary/30 bg-secondary/60 border border-border/60 focus:border-primary/40";

function Field({ label, icon, children, hint }: {
  label: string; icon?: React.ReactNode; children: React.ReactNode; hint?: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest mb-1.5 text-primary/70">
        {icon}<span>{label}</span>
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
function Inp({ value, onChange, placeholder = "", type = "text" }: any) {
  return <input type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder} className={inputCls} />;
}
function Txtarea({ value, onChange, placeholder = "", rows = 4 }: any) {
  return <textarea value={value ?? ""} onChange={onChange} placeholder={placeholder} rows={rows} className={`${inputCls} resize-y`} />;
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
      <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">{label}</span>
    </label>
  );
}
function JsonEditor({ value, onChange, hint }: { value: any; onChange: (v: any) => void; hint?: string }) {
  const [raw, setRaw] = useState(() => JSON.stringify(value ?? [], null, 2));
  const [err, setErr] = useState(false);
  useEffect(() => { setRaw(JSON.stringify(value ?? [], null, 2)); }, [JSON.stringify(value)]);
  return (
    <div>
      {hint && <p className="text-xs text-muted-foreground bg-secondary/40 px-3 py-2 rounded-lg mb-3">{hint}</p>}
      <textarea
        value={raw}
        onChange={(e: any) => {
          setRaw(e.target.value);
          try { onChange(JSON.parse(e.target.value)); setErr(false); } catch { setErr(true); }
        }}
        rows={8}
        className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
      />
      {err && <p className="text-xs text-destructive mt-1 font-medium">⚠ Invalid JSON — fix before saving.</p>}
    </div>
  );
}

// ─── Type definitions ──────────────────────────────────────────────────────────
type SectionDef = {
  key: string;
  label: string;
  icon: React.ReactNode;
  isRoot?: boolean;
  cmsDotOverride?: string;
  editor: (data: any, set: (d: any) => void) => React.ReactNode;
};

type PageDef = {
  id: string;
  label: string;
  icon: any;
  color: string;
  bg: string;
  cmsDot: string;
  previewPath: string;
  dbSlug: string;
  isCustom?: boolean;
};

// ─── Pre-defined pages ─────────────────────────────────────────────────────────
const BASE_PAGES: PageDef[] = [
  { id: "home",            label: "Home",      icon: Home,      color: "text-primary",      bg: "bg-primary/10",      cmsDot: "hero",              previewPath: "/",                  dbSlug: "home" },
  { id: "about",           label: "About",     icon: Info,      color: "text-emerald-400",  bg: "bg-emerald-500/10",  cmsDot: "pages.about",       previewPath: "/about-us",          dbSlug: "about" },
  { id: "contact",         label: "Contact",   icon: Mail,      color: "text-sky-400",      bg: "bg-sky-500/10",      cmsDot: "pages.contact",     previewPath: "/contact-us",        dbSlug: "contact" },
  { id: "sharedHosting",   label: "Shared",    icon: Server,    color: "text-blue-400",     bg: "bg-blue-500/10",     cmsDot: "pages.sharedHosting",    previewPath: "/shared-hosting",    dbSlug: "shared-hosting" },
  { id: "wordpressHosting",label: "WordPress", icon: Layout,    color: "text-indigo-400",   bg: "bg-indigo-500/10",   cmsDot: "pages.wordpressHosting", previewPath: "/wordpress-hosting", dbSlug: "wordpress-hosting" },
  { id: "resellerHosting", label: "Reseller",  icon: Users,     color: "text-violet-400",   bg: "bg-violet-500/10",   cmsDot: "pages.resellerHosting",  previewPath: "/reseller-hosting",  dbSlug: "reseller-hosting" },
  { id: "vpsHosting",      label: "VPS",       icon: Cpu,       color: "text-rose-400",     bg: "bg-rose-500/10",     cmsDot: "pages.vpsHosting",  previewPath: "/vps-hosting",       dbSlug: "vps-hosting" },
  { id: "domains",         label: "Domains",   icon: Globe,     color: "text-cyan-400",     bg: "bg-cyan-500/10",     cmsDot: "pages.domains",     previewPath: "/domains",           dbSlug: "domains" },
  { id: "terms",           label: "Terms",     icon: FileText,  color: "text-amber-400",    bg: "bg-amber-500/10",    cmsDot: "pages.terms",       previewPath: "/terms-and-conditions", dbSlug: "terms" },
  { id: "privacy",         label: "Privacy",   icon: Shield,    color: "text-teal-400",     bg: "bg-teal-500/10",     cmsDot: "pages.privacy",     previewPath: "/privacy-policy",    dbSlug: "privacy" },
];

// ─── Shared hero editor ────────────────────────────────────────────────────────
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

// ─── Section definitions ───────────────────────────────────────────────────────
const SECTION_DEFS: Record<string, SectionDef[]> = {

  // ─── Home ────────────────────────────────────────────────────────────────────
  home: [
    {
      key: "hero", label: "Hero Section", icon: <Home size={13} />, isRoot: true, cmsDotOverride: "hero",
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Badge Text" icon={<Tag size={11} />} hint='Small label above the heading, e.g. "Special Offer: Save 75%"'>
            <Inp value={c.badge} onChange={(e: any) => set({ ...c, badge: e.target.value })} placeholder="Special Offer: Save 75% Today" />
          </Field>
          <Field label="Main Heading" icon={<Type size={11} />}>
            <Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Empower Your Digital Future with Noehost" />
          </Field>
          <Field label="Description" icon={<AlignLeft size={11} />}>
            <Txtarea value={c.description} onChange={(e: any) => set({ ...c, description: e.target.value })} rows={3} placeholder="Experience next-gen hosting..." />
          </Field>
          <Field label="Starting Price (USD/mo)" hint="Numeric value shown as the 'Starting at' price">
            <Inp type="number" value={c.startingPrice} onChange={(e: any) => set({ ...c, startingPrice: parseFloat(e.target.value) || 0 })} placeholder="1.99" />
          </Field>
          <Field label="Feature Bullet Points" icon={<List size={11} />}>
            <JsonEditor value={c.features ?? []} onChange={(v) => set({ ...c, features: v })} hint='Array of strings: ["Free SSL Certificates", "24/7 Expert Support", ...]' />
          </Field>
          <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 space-y-4">
            <p className="text-xs font-bold text-primary/70 uppercase tracking-widest">Primary CTA Button</p>
            <Toggle checked={c.showCtaPrimary !== false} onChange={(v) => set({ ...c, showCtaPrimary: v })} label="Show primary button" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Button Text"><Inp value={c.ctaPrimary} onChange={(e: any) => set({ ...c, ctaPrimary: e.target.value })} placeholder="Get Started" /></Field>
              <Field label="Button URL"><Inp value={c.ctaPrimaryHref} onChange={(e: any) => set({ ...c, ctaPrimaryHref: e.target.value })} placeholder="/shared-hosting" /></Field>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 space-y-4">
            <p className="text-xs font-bold text-primary/70 uppercase tracking-widest">Secondary CTA Button</p>
            <Toggle checked={c.showCtaSecondary === true} onChange={(v) => set({ ...c, showCtaSecondary: v })} label="Show secondary button" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Button Text"><Inp value={c.ctaSecondary} onChange={(e: any) => set({ ...c, ctaSecondary: e.target.value })} placeholder="View Pricing" /></Field>
              <Field label="Button URL"><Inp value={c.ctaSecondaryHref} onChange={(e: any) => set({ ...c, ctaSecondaryHref: e.target.value })} placeholder="/#pricing" /></Field>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "topbar", label: "Top Bar", icon: <Megaphone size={13} />, isRoot: true, cmsDotOverride: "config",
      editor: (c, set) => {
        const tb = c.topbar ?? {};
        const setTb = (v: any) => set({ ...c, topbar: { ...tb, ...v } });
        return (
          <div className="space-y-5">
            <Toggle checked={tb.show !== false} onChange={(v) => setTb({ show: v })} label="Show top announcement bar" />
            <Field label="Announcement Text" icon={<Megaphone size={11} />} hint="Flash sale, discount code, or any short announcement">
              <Inp value={tb.announcement} onChange={(e: any) => setTb({ announcement: e.target.value })} placeholder="Flash Sale: 50% Off all Shared Plans!" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Support Email" icon={<AtSign size={11} />}>
                <Inp value={tb.email} onChange={(e: any) => setTb({ email: e.target.value })} placeholder="support@noehost.com" />
              </Field>
              <Field label="Support Phone" icon={<Phone size={11} />}>
                <Inp value={tb.phone} onChange={(e: any) => setTb({ phone: e.target.value })} placeholder="+92 300 0000000" />
              </Field>
            </div>
          </div>
        );
      },
    },
    {
      key: "navbar", label: "Navbar & Logo", icon: <Navigation size={13} />, isRoot: true, cmsDotOverride: "navbar",
      editor: (c, set) => (
        <div className="space-y-5">
          <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 space-y-4">
            <p className="text-xs font-bold text-primary/70 uppercase tracking-widest">Logo</p>
            <Field label="Text Logo" hint="Shown when no image is set">
              <Inp value={c.logo} onChange={(e: any) => set({ ...c, logo: e.target.value })} placeholder="NOEHOST" />
            </Field>
            <Field label="Logo Image URL" icon={<Image size={11} />} hint="Leave blank to use text logo">
              <Inp value={c.logoImage} onChange={(e: any) => set({ ...c, logoImage: e.target.value })} placeholder="https://... or /uploads/logo.png" />
            </Field>
            <Field label="Logo Link URL">
              <Inp value={c.logoUrl} onChange={(e: any) => set({ ...c, logoUrl: e.target.value })} placeholder="/" />
            </Field>
          </div>
          <Field label="Navigation Links" icon={<Link2 size={11} />}>
            <JsonEditor
              value={c.links ?? []}
              onChange={(v) => set({ ...c, links: v })}
              hint='Array of { "name": "Home", "href": "/", "icon": "Home", "color": "text-primary" }. Icon names: Home, Server, Cpu, Users, Layout, Globe, Info, Mail'
            />
          </Field>
        </div>
      ),
    },
    {
      key: "footer", label: "Footer", icon: <Monitor size={13} />, isRoot: true, cmsDotOverride: "footer",
      editor: (c, set) => {
        const ct = c.contact ?? {};
        const setCt = (v: any) => set({ ...c, contact: { ...ct, ...v } });
        return (
          <div className="space-y-5">
            <Field label="About / Tagline" icon={<AlignLeft size={11} />} hint="Short description shown in the footer">
              <Txtarea value={c.about} onChange={(e: any) => set({ ...c, about: e.target.value })} rows={3} placeholder="Noehost is a world-class web hosting provider..." />
            </Field>
            <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 space-y-4">
              <p className="text-xs font-bold text-primary/70 uppercase tracking-widest">Contact Info</p>
              <Field label="Address"><Inp value={ct.address} onChange={(e: any) => setCt({ address: e.target.value })} placeholder="123 Cloud Avenue, Tech City" /></Field>
              <Field label="Phone"><Inp value={ct.phone} onChange={(e: any) => setCt({ phone: e.target.value })} placeholder="+1 (800) NEO-HOST" /></Field>
              <Field label="Email"><Inp value={ct.email} onChange={(e: any) => setCt({ email: e.target.value })} placeholder="support@noehost.com" /></Field>
            </div>
          </div>
        );
      },
    },
  ],

  // ─── About ───────────────────────────────────────────────────────────────────
  about: [
    { key: "hero", label: "Hero Banner", icon: <Home size={13} />, editor: heroEditor },
    {
      key: "stats", label: "Stats Row", icon: <List size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "value": "99.9%", "label": "Uptime SLA" } objects.' />
      ),
    },
    {
      key: "values", label: "Core Values", icon: <CheckCircle2 size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "title": "Reliability", "desc": "99.9% uptime..." } objects.' />
      ),
    },
    {
      key: "milestones", label: "Milestones", icon: <List size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "year": "2019", "title": "Founded", "desc": "..." } objects.' />
      ),
    },
    {
      key: "team", label: "Team Members", icon: <Users size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "name": "Alex Johnson", "role": "CEO", "bio": "..." } objects.' />
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
          <Field label="Heading"><Inp value={c.ctaTitle} onChange={(e: any) => set({ ...c, ctaTitle: e.target.value })} placeholder="Ready to Experience Noehost?" /></Field>
          <Field label="Description"><Txtarea value={c.ctaDesc} onChange={(e: any) => set({ ...c, ctaDesc: e.target.value })} rows={2} /></Field>
          <Field label="Button Text"><Inp value={c.ctaBtnText} onChange={(e: any) => set({ ...c, ctaBtnText: e.target.value })} placeholder="Get Started Today" /></Field>
          <Field label="Button URL"><Inp value={c.ctaBtnUrl} onChange={(e: any) => set({ ...c, ctaBtnUrl: e.target.value })} placeholder="/register" /></Field>
        </div>
      ),
    },
  ],

  // ─── Contact ──────────────────────────────────────────────────────────────────
  contact: [
    { key: "hero", label: "Hero Banner", icon: <Home size={13} />, editor: heroEditor },
    {
      key: "channels", label: "Support Channels", icon: <Mail size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "type": "Live Chat", "desc": "24/7 instant support...", "action": "Start Chat", "url": "#" }.' />
      ),
    },
    {
      key: "offices", label: "Office Locations", icon: <Globe size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "city": "Karachi", "country": "Pakistan", "address": "...", "phone": "...", "email": "...", "primary": true }.' />
      ),
    },
    {
      key: "faqs", label: "FAQ Items", icon: <List size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "q": "Question?", "a": "Answer..." } objects.' />
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
  ],

  // ─── Shared Hosting ───────────────────────────────────────────────────────────
  sharedHosting: [
    { key: "hero", label: "Hero Banner", icon: <Home size={13} />, editor: heroEditor },
    {
      key: "_plansText", label: "Plans Section Text", icon: <Type size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Plans Section Title"><Inp value={c.plansTitle} onChange={(e: any) => set({ ...c, plansTitle: e.target.value })} placeholder="Simple, Transparent Pricing" /></Field>
          <Field label="Plans Subtitle"><Inp value={c.plansSubtitle} onChange={(e: any) => set({ ...c, plansSubtitle: e.target.value })} placeholder="No hidden fees. Cancel anytime." /></Field>
          <p className="text-xs text-muted-foreground bg-secondary/40 px-3 py-2 rounded-lg">
            Pricing plans are managed under <span className="text-primary font-semibold">Admin → Packages</span>.
          </p>
        </div>
      ),
    },
    {
      key: "_featuresText", label: "Features Section Text", icon: <Type size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Features Section Title"><Inp value={c.featuresTitle} onChange={(e: any) => set({ ...c, featuresTitle: e.target.value })} placeholder="Built for Your Success" /></Field>
          <Field label="Features Description"><Txtarea value={c.featuresDesc} onChange={(e: any) => set({ ...c, featuresDesc: e.target.value })} rows={2} /></Field>
        </div>
      ),
    },
    {
      key: "features", label: "Feature Cards", icon: <List size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "title": "Free SSL Certificate", "desc": "Every domain gets..." }.' />
      ),
    },
    {
      key: "_faqMeta", label: "FAQ Section Title", icon: <Type size={13} />, isRoot: true,
      editor: (c, set) => (
        <Field label="FAQ Section Title"><Inp value={c.faqTitle} onChange={(e: any) => set({ ...c, faqTitle: e.target.value })} placeholder="Frequently Asked Questions" /></Field>
      ),
    },
    {
      key: "faqs", label: "FAQ Items", icon: <List size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "q": "Question?", "a": "Answer..." } objects.' />
      ),
    },
  ],

  // ─── WordPress Hosting ────────────────────────────────────────────────────────
  wordpressHosting: [
    { key: "hero", label: "Hero Banner", icon: <Home size={13} />, editor: heroEditor },
    {
      key: "features", label: "Feature Cards", icon: <List size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "title": "Feature Name", "desc": "Description..." } objects.' />
      ),
    },
    {
      key: "faqs", label: "FAQ Items", icon: <List size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "q": "Question?", "a": "Answer..." } objects.' />
      ),
    },
  ],

  // ─── Reseller Hosting ─────────────────────────────────────────────────────────
  resellerHosting: [
    { key: "hero", label: "Hero Banner", icon: <Home size={13} />, editor: heroEditor },
    {
      key: "_stepsText", label: "Steps Section Text", icon: <Type size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Steps Section Title"><Inp value={c.stepsTitle} onChange={(e: any) => set({ ...c, stepsTitle: e.target.value })} placeholder="Start Your Hosting Business in 3 Steps" /></Field>
          <Field label="Steps Description"><Txtarea value={c.stepsDesc} onChange={(e: any) => set({ ...c, stepsDesc: e.target.value })} rows={2} /></Field>
        </div>
      ),
    },
    {
      key: "features", label: "Feature Cards", icon: <List size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "title": "WHM Control Panel", "desc": "Description..." } objects.' />
      ),
    },
    {
      key: "faqs", label: "FAQ Items", icon: <List size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "q": "Question?", "a": "Answer..." } objects.' />
      ),
    },
    {
      key: "_cta", label: "Call to Action", icon: <Tag size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="CTA Heading"><Inp value={c.ctaTitle} onChange={(e: any) => set({ ...c, ctaTitle: e.target.value })} placeholder="Ready to Start Your Hosting Business?" /></Field>
          <Field label="CTA Description"><Txtarea value={c.ctaDesc} onChange={(e: any) => set({ ...c, ctaDesc: e.target.value })} rows={2} /></Field>
          <Field label="Button Text"><Inp value={c.ctaBtnText} onChange={(e: any) => set({ ...c, ctaBtnText: e.target.value })} placeholder="Start Reselling Today" /></Field>
          <Field label="Button URL"><Inp value={c.ctaBtnUrl} onChange={(e: any) => set({ ...c, ctaBtnUrl: e.target.value })} placeholder="/register" /></Field>
        </div>
      ),
    },
  ],

  // ─── VPS Hosting ──────────────────────────────────────────────────────────────
  vpsHosting: [
    { key: "hero", label: "Hero Banner", icon: <Home size={13} />, editor: heroEditor },
    {
      key: "useCases", label: "Use Cases", icon: <List size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "title": "High-Traffic Websites", "desc": "Dedicated resources..." }.' />
      ),
    },
    {
      key: "securityItems", label: "Security Features", icon: <Shield size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "title": "DDoS Mitigation", "desc": "Up to 400 Gbps..." }.' />
      ),
    },
    {
      key: "datacenters", label: "Data Centers", icon: <Globe size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "city": "Karachi", "region": "South Asia", "ping": "8ms" }.' />
      ),
    },
    {
      key: "_migrationText", label: "Migration Section", icon: <Type size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Migration Section Title"><Inp value={c.migrationTitle} onChange={(e: any) => set({ ...c, migrationTitle: e.target.value })} placeholder="Free Migration to Noehost VPS" /></Field>
          <Field label="Migration Description"><Txtarea value={c.migrationDesc} onChange={(e: any) => set({ ...c, migrationDesc: e.target.value })} rows={3} /></Field>
          <Field label="Button Text"><Inp value={c.migrationBtnText} onChange={(e: any) => set({ ...c, migrationBtnText: e.target.value })} placeholder="Request Free Migration" /></Field>
          <Field label="Button URL"><Inp value={c.migrationBtnUrl} onChange={(e: any) => set({ ...c, migrationBtnUrl: e.target.value })} placeholder="/contact-us" /></Field>
        </div>
      ),
    },
  ],

  // ─── Domains ──────────────────────────────────────────────────────────────────
  domains: [
    {
      key: "hero", label: "Hero Banner", icon: <Home size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground bg-secondary/40 px-3 py-2 rounded-lg">
            TLD pricing is managed under <span className="text-primary font-semibold">Admin → Domain Extensions</span>.
          </p>
          <Field label="Badge Text"><Inp value={c.badge} onChange={(e: any) => set({ ...c, badge: e.target.value })} placeholder="Domain Registration" /></Field>
          <Field label="Main Heading"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Find Your Perfect" /></Field>
          <Field label="Heading Highlight (coloured)"><Inp value={c.titleHighlight} onChange={(e: any) => set({ ...c, titleHighlight: e.target.value })} placeholder="Domain Name." /></Field>
          <Field label="Description"><Txtarea value={c.description} onChange={(e: any) => set({ ...c, description: e.target.value })} rows={3} /></Field>
        </div>
      ),
    },
  ],

  // ─── Terms ────────────────────────────────────────────────────────────────────
  terms: [
    {
      key: "_pageInfo", label: "Page Header", icon: <FileText size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Page Title"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Terms & Conditions" /></Field>
          <Field label="Last Updated Date"><Inp value={c.lastUpdated} onChange={(e: any) => set({ ...c, lastUpdated: e.target.value })} placeholder="January 15, 2025" /></Field>
          <Field label="Intro Paragraph"><Txtarea value={c.intro} onChange={(e: any) => set({ ...c, intro: e.target.value })} rows={3} /></Field>
        </div>
      ),
    },
    {
      key: "sections", label: "T&C Sections", icon: <List size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "title": "1. Account Responsibility", "content": "You are responsible for..." }. Each renders as an accordion.' />
      ),
    },
  ],

  // ─── Privacy ──────────────────────────────────────────────────────────────────
  privacy: [
    {
      key: "_pageInfo", label: "Page Header", icon: <Shield size={13} />, isRoot: true,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Page Title"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Privacy Policy" /></Field>
          <Field label="Last Updated Date"><Inp value={c.lastUpdated} onChange={(e: any) => set({ ...c, lastUpdated: e.target.value })} placeholder="January 15, 2025" /></Field>
          <Field label="Intro Paragraph"><Txtarea value={c.intro} onChange={(e: any) => set({ ...c, intro: e.target.value })} rows={3} /></Field>
        </div>
      ),
    },
    {
      key: "sections", label: "Policy Sections", icon: <List size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "title": "1. Information We Collect", "content": "Account info, payment info..." }.' />
      ),
    },
  ],

  // ─── Custom Page (generic template) ──────────────────────────────────────────
  _custom: [
    {
      key: "hero", label: "Hero Banner", icon: <Home size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Badge / Label"><Inp value={c.badge} onChange={(e: any) => set({ ...c, badge: e.target.value })} placeholder="Welcome" /></Field>
          <Field label="Main Heading"><Inp value={c.title} onChange={(e: any) => set({ ...c, title: e.target.value })} placeholder="Page Title" /></Field>
          <Field label="Heading Highlight"><Inp value={c.titleHighlight} onChange={(e: any) => set({ ...c, titleHighlight: e.target.value })} placeholder="Highlighted word" /></Field>
          <Field label="Description"><Txtarea value={c.description} onChange={(e: any) => set({ ...c, description: e.target.value })} rows={4} placeholder="Page description..." /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Button Text"><Inp value={c.btnText} onChange={(e: any) => set({ ...c, btnText: e.target.value })} placeholder="Get Started" /></Field>
            <Field label="Button URL"><Inp value={c.btnUrl} onChange={(e: any) => set({ ...c, btnUrl: e.target.value })} placeholder="/register" /></Field>
          </div>
        </div>
      ),
    },
    {
      key: "text", label: "Text Content", icon: <AlignLeft size={13} />,
      editor: (c, set) => (
        <div className="space-y-4">
          <Field label="Section Heading"><Inp value={c.heading} onChange={(e: any) => set({ ...c, heading: e.target.value })} placeholder="About This Page" /></Field>
          <Field label="Main Content" hint="Use plain text or HTML. Displayed as a rich text block.">
            <Txtarea value={c.content} onChange={(e: any) => set({ ...c, content: e.target.value })} rows={12} placeholder="Write your page content here..." />
          </Field>
        </div>
      ),
    },
    {
      key: "faq", label: "FAQ Section", icon: <List size={13} />,
      editor: (c, set) => (
        <JsonEditor value={c} onChange={set} hint='Array of { "q": "Question?", "a": "Answer..." } objects. Leave empty to hide this section.' />
      ),
    },
  ],
};

// ─── Meta Tags Editor ──────────────────────────────────────────────────────────
function MetaTagsEditor({ dbSlug, token }: { dbSlug: string; token: string | null }) {
  const [data, setData] = useState({ pageTitle: "", metaDescription: "", keywords: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(`/api/admin/pages/${dbSlug}`, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((row) => {
        if (row) setData({ pageTitle: row.pageTitle ?? "", metaDescription: row.metaDescription ?? "", keywords: row.keywords ?? "" });
      })
      .catch(() => setError("Failed to load meta data"))
      .finally(() => setLoading(false));
  }, [dbSlug]);

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/pages/${dbSlug}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ pageTitle: data.pageTitle, metaDescription: data.metaDescription, keywords: data.keywords }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { alert("Save failed — please try again."); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw size={18} className="animate-spin text-primary mr-3" />
      <span className="text-sm text-muted-foreground">Loading meta tags…</span>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold">SEO & Meta Tags</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Controls page title, description shown in search results and browser tabs.</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full flex items-center gap-1"><CheckCircle2 size={11} /> Saved!</span>}
          <button
            onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40 shadow-lg"
            style={{ background: "linear-gradient(135deg,#673de6,#8b5cf6)" }}
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : "Save Meta Tags"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-2xl border border-border/60 bg-secondary/20 p-5 space-y-5">
        <Field label="Page Title" icon={<Type size={11} />} hint="Shown in the browser tab and Google search results (50–60 chars recommended)">
          <Inp value={data.pageTitle} onChange={(e: any) => setData(d => ({ ...d, pageTitle: e.target.value }))} placeholder="Fast & Reliable Web Hosting | Noehost" />
          <div className="text-right text-[11px] text-muted-foreground mt-1">{data.pageTitle.length} / 60</div>
        </Field>
        <Field label="Meta Description" icon={<AlignLeft size={11} />} hint="Shown below the title in search results (150–160 chars recommended)">
          <Txtarea value={data.metaDescription} onChange={(e: any) => setData(d => ({ ...d, metaDescription: e.target.value }))} rows={3} placeholder="Get blazing-fast hosting with 99.9% uptime, free SSL, and 24/7 expert support. Start from just $1.99/mo." />
          <div className="text-right text-[11px] text-muted-foreground mt-1">{data.metaDescription.length} / 160</div>
        </Field>
        <Field label="Keywords" icon={<Tag size={11} />} hint="Comma-separated keywords (less important for modern SEO, but useful for internal search)">
          <Inp value={data.keywords} onChange={(e: any) => setData(d => ({ ...d, keywords: e.target.value }))} placeholder="web hosting, cheap hosting, cPanel hosting, Noehost" />
        </Field>
      </div>

      {/* Preview card */}
      <div className="rounded-xl border border-border/40 bg-secondary/10 p-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Search Result Preview</p>
        <div className="max-w-lg">
          <div className="text-xs text-green-600 dark:text-green-400 mb-0.5">noehost.com</div>
          <div className="text-blue-600 dark:text-blue-400 text-base font-medium leading-snug hover:underline cursor-pointer">
            {data.pageTitle || "Page Title"}
          </div>
          <div className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">
            {data.metaDescription || "Meta description will appear here…"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section Editor ────────────────────────────────────────────────────────────
function SectionEditor({
  sectionDef, initData, onSave,
}: {
  sectionDef: SectionDef;
  initData: any;
  onSave: (localData: any, allData: any) => Promise<void>;
}) {
  const [localData, setLocalData] = useState<any>(initData ?? (sectionDef.isRoot ? {} : []));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    setLocalData(initData ?? (sectionDef.isRoot ? {} : []));
    setSavedAt(null);
  }, [sectionDef.key, JSON.stringify(initData)]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(localData, initData);
      setSavedAt(new Date());
    } catch (err) {
      console.error("[PageManager] save error:", err);
      alert("Save failed — please try again.");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{sectionDef.icon}</span>
            <h3 className="text-base font-bold text-foreground">{sectionDef.label}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Changes are saved to the database and go live after page refresh.</p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full">
              <CheckCircle2 size={12} /> Saved!
            </span>
          )}
          <button
            onClick={save} disabled={saving}
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
function PageTab({ page, token }: { page: PageDef; token: string | null }) {
  const sections = page.isCustom ? SECTION_DEFS["_custom"] : (SECTION_DEFS[page.id] ?? []);

  const [fullContent, setFullContent] = useState<any>(null);
  const [customSectionsJson, setCustomSectionsJson] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.key ?? "");
  const [activeTab, setActiveTab] = useState<"content" | "meta">("content");
  const [error, setError] = useState<string | null>(null);

  const headers = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }, [token]);

  const fetchContent = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (page.isCustom) {
        const res = await fetch(`/api/admin/pages/${page.dbSlug}`, { headers: headers() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const row = await res.json();
        try { setCustomSectionsJson(JSON.parse(row.sectionsJson ?? "{}")); } catch { setCustomSectionsJson({}); }
      } else {
        const res = await fetch("/api/content", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setFullContent(await res.json());
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [page.id, page.dbSlug, page.isCustom]);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const getSectionInitData = (s: SectionDef): any => {
    if (page.isCustom) {
      return s.isRoot ? customSectionsJson : (customSectionsJson[s.key] ?? (Array.isArray([]) ? [] : {}));
    }
    const key = s.cmsDotOverride ?? page.cmsDot;
    const data = fullContent?.[key] ?? {};
    return s.isRoot ? data : (data[s.key] ?? []);
  };

  const makeSaveHandler = (s: SectionDef) => async (localData: any, allData: any) => {
    if (page.isCustom) {
      const updated = s.isRoot
        ? { ...customSectionsJson, ...localData }
        : { ...customSectionsJson, [s.key]: localData };
      const res = await fetch(`/api/admin/pages/${page.dbSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({ sectionsJson: JSON.stringify(updated) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCustomSectionsJson(updated);
    } else {
      const key = s.cmsDotOverride ?? page.cmsDot;
      const current = fullContent?.[key] ?? {};
      const updated = s.isRoot
        ? { ...current, ...localData }
        : { ...current, [s.key]: localData };
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({ key, value: updated }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      try { localStorage.setItem("noehost_content_updated", Date.now().toString()); } catch {}
      await fetchContent();
    }
  };

  const currentSectionDef = sections.find((s) => s.key === activeSection) ?? sections[0];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw size={20} className="animate-spin text-primary mr-3" />
      <span className="text-sm text-muted-foreground">Loading page content…</span>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <AlertCircle size={24} className="text-destructive" />
      <p className="text-sm text-muted-foreground">{error}</p>
      <button onClick={fetchContent} className="text-xs text-primary hover:underline">Retry</button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Tab bar: Content Sections | Meta Tags */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary/30 border border-border/40 w-fit">
        {[
          { id: "content", label: "Content Sections", icon: <Layout size={13} /> },
          { id: "meta",    label: "SEO & Meta Tags",  icon: <Tag size={13} /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {activeTab === "meta" ? (
        <MetaTagsEditor dbSlug={page.dbSlug} token={token} />
      ) : sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Info size={24} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No editable sections for this page yet.</p>
        </div>
      ) : (
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
                key={`${page.id}-${activeSection}`}
                sectionDef={currentSectionDef}
                initData={getSectionInitData(currentSectionDef)}
                onSave={makeSaveHandler(currentSectionDef)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add New Page Modal ────────────────────────────────────────────────────────
function AddPageModal({
  token, onClose, onCreated,
}: {
  token: string | null;
  onClose: () => void;
  onCreated: (p: PageDef) => void;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toSlug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleTitleChange = (v: string) => {
    setTitle(v);
    if (!slugManual) setSlug(toSlug(v));
  };

  const create = async () => {
    if (!title.trim() || !slug.trim()) { setError("Title and slug are required."); return; }
    setSaving(true); setError(null);
    try {
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers,
        body: JSON.stringify({ pageTitle: title.trim(), pageSlug: slug.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onCreated({
        id: slug.trim(),
        label: title.trim(),
        icon: FileText,
        color: "text-muted-foreground",
        bg: "bg-secondary/30",
        cmsDot: slug.trim(),
        previewPath: `/p/${slug.trim()}`,
        dbSlug: slug.trim(),
        isCustom: true,
      });
      onClose();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border/60 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Add New Page</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground"><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <Field label="Page Title" hint="The human-readable name shown in menus and the admin sidebar">
            <Inp value={title} onChange={(e: any) => handleTitleChange(e.target.value)} placeholder="About Our Company" />
          </Field>
          <Field label="URL Slug" hint={`Your page will be live at: /p/${slug || "my-page"}`}>
            <Inp
              value={slug}
              onChange={(e: any) => { setSlugManual(true); setSlug(toSlug(e.target.value)); }}
              placeholder="about-our-company"
            />
          </Field>
          <p className="text-xs text-muted-foreground bg-secondary/40 px-3 py-2 rounded-lg">
            A default Hero + Text + FAQ template will be created. You can edit all sections immediately after creation.
          </p>
          {error && <p className="text-sm text-destructive font-medium">{error}</p>}
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t border-border/40">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">Cancel</button>
          <button
            onClick={create} disabled={saving || !title.trim() || !slug.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40 shadow-lg"
            style={{ background: "linear-gradient(135deg,#673de6,#8b5cf6)" }}
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
            {saving ? "Creating…" : "Create Page"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main PageManager ──────────────────────────────────────────────────────────
export default function PageManager() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const [pages, setPages] = useState<PageDef[]>(BASE_PAGES);
  const [activePage, setActivePage] = useState<string>(BASE_PAGES[0].id);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(true);

  useEffect(() => {
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch("/api/admin/pages", { headers })
      .then((r) => r.ok ? r.json() : { pages: [] })
      .then(({ pages: dbPages }: { pages: any[] }) => {
        const knownSlugs = new Set(BASE_PAGES.map((p) => p.dbSlug));
        const custom: PageDef[] = dbPages
          .filter((p: any) => !knownSlugs.has(p.pageSlug))
          .map((p: any) => ({
            id: p.pageSlug,
            label: p.pageTitle,
            icon: FileText,
            color: "text-muted-foreground",
            bg: "bg-secondary/30",
            cmsDot: p.pageSlug,
            previewPath: `/p/${p.pageSlug}`,
            dbSlug: p.pageSlug,
            isCustom: true,
          }));
        if (custom.length > 0) setPages([...BASE_PAGES, ...custom]);
      })
      .catch(() => {})
      .finally(() => setLoadingCustom(false));
  }, []);

  const activeDef = pages.find((p) => p.id === activePage) ?? pages[0];

  return (
    <div className="flex gap-5 min-h-[600px]">
      {/* ── Left sidebar: page list ────────────────────────────────────────── */}
      <div className="w-56 shrink-0 space-y-0.5">
        <div className="px-3 py-2 mb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pages</p>
        </div>

        {pages.map((p) => {
          const Icon = p.icon;
          const active = activePage === p.id;
          return (
            <div key={p.id} className="flex items-center gap-1">
              <button
                onClick={() => setActivePage(p.id)}
                className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                  active ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <Icon size={14} className={active ? "text-primary" : p.color} />
                <span className="text-sm font-semibold truncate">{p.label}</span>
                {active && <ChevronRight size={11} className="ml-auto shrink-0" />}
              </button>
              <a
                href={p.previewPath}
                target="_blank"
                rel="noopener noreferrer"
                title={`Preview ${p.label} page`}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all shrink-0"
              >
                <ExternalLink size={12} />
              </a>
            </div>
          );
        })}

        {/* Add New Page */}
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 mt-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/30 border border-dashed border-border/60 transition-all text-sm font-medium"
        >
          <Plus size={14} />
          Add New Page
        </button>
      </div>

      {/* ── Right: active page editor ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Page header */}
        {activeDef && (
          <div className={`rounded-xl ${activeDef.bg} border border-border/40 px-5 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <activeDef.icon size={16} className={activeDef.color} />
              <div>
                <p className="text-sm font-bold text-foreground">{activeDef.label} Page</p>
                <p className="text-xs text-muted-foreground">
                  Edit any section below — changes go live on your website immediately after saving.
                </p>
              </div>
            </div>
            <a
              href={activeDef.previewPath}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground bg-background/50 hover:bg-background border border-border/40 transition-all"
            >
              <Eye size={12} /> Preview Page
            </a>
          </div>
        )}

        <PageTab key={activePage} page={activeDef} token={token} />
      </div>

      {/* Add New Page Modal */}
      {showAddModal && (
        <AddPageModal
          token={token}
          onClose={() => setShowAddModal(false)}
          onCreated={(newPage) => {
            setPages((prev) => [...prev, newPage]);
            setActivePage(newPage.id);
          }}
        />
      )}
    </div>
  );
}
