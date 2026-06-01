import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp, Search, Share2, BadgeCheck, Loader2, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, Globe, ChevronDown,
  Facebook, Twitter, Sparkles, Trophy, Star, Zap, ExternalLink,
  FileText, MapPin, Shield, Smartphone, Link2, AlignLeft,
  Target, Plus, Trash2, ArrowDown, ArrowUp, Minus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ───────────────────────────────────────────────────────────────────
interface SeoScan {
  domain: string; fetchOk: boolean;
  title: string; metaDesc: string;
  ogTitle: string; ogDesc: string; ogImage: string;
  twitterCard: string; twitterImage: string;
  canonical: string; h1Count: number;
  sitemapOk: boolean; robotsOk: boolean;
  httpsOk: boolean; viewportOk: boolean;
  score: number; scannedAt: string;
}
interface Domain { id: string; domain: string; planName: string; }
interface AdTier { credit: string; badge: string; label: string; color: string; bg: string; desc: string; threshold: number; }
interface AdCredits {
  totalSpentBase: number; paidInvoiceCount: number;
  eligible: AdTier | null; nextTier: AdTier | null; progress: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function authHeaders() {
  const t = localStorage.getItem("token") || localStorage.getItem("noehost_token") || "";
  return { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
}
function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}
function scoreColor(s: number) {
  return s >= 80 ? "#10B981" : s >= 55 ? "#F59E0B" : "#EF4444";
}
function scoreLabel(s: number) {
  return s >= 80 ? "Excellent" : s >= 55 ? "Needs Work" : "Poor";
}

// ─── SEO Check Row ────────────────────────────────────────────────────────────
function CheckRow({ ok, label, value, tip }: { ok: boolean | null; label: string; value?: string; tip?: string }) {
  const [open, setOpen] = useState(false);
  const color = ok === null ? "text-muted-foreground" : ok ? "text-green-500" : "text-red-400";
  const Icon  = ok === null ? AlertCircle : ok ? CheckCircle2 : XCircle;
  return (
    <div className="border-b border-border/40 last:border-0">
      <div
        className={`flex items-center gap-2.5 px-4 py-3 ${tip ? "cursor-pointer hover:bg-secondary/20" : ""} transition-colors`}
        onClick={() => tip && setOpen(o => !o)}>
        <Icon size={14} className={`${color} shrink-0`} />
        <span className="flex-1 text-sm font-semibold text-foreground">{label}</span>
        {value && (
          <span className="text-[11px] text-muted-foreground max-w-[160px] truncate hidden sm:block">{value}</span>
        )}
        {!ok && tip && (
          <ChevronDown size={12} className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        )}
      </div>
      {open && tip && !ok && (
        <div className="mx-4 mb-3 ml-10 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          💡 {tip}
        </div>
      )}
    </div>
  );
}

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 34; const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <div className="relative w-[90px] h-[90px] shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - dash}
          style={{ transition: "stroke-dashoffset 1.2s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[18px] font-black leading-none" style={{ color }}>{score}</span>
        <span className="text-[9px] text-muted-foreground font-semibold">/ 100</span>
      </div>
    </div>
  );
}

// ─── Facebook Card Preview ────────────────────────────────────────────────────
function FacebookCard({ scan }: { scan: SeoScan }) {
  const title  = scan.ogTitle  || scan.title  || scan.domain;
  const desc   = scan.ogDesc   || scan.metaDesc || "No description found.";
  const image  = scan.ogImage  || "";
  const domain = scan.domain.replace(/^https?:\/\//, "").split("/")[0];
  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
      {image ? (
        <img src={image} alt="og" className="w-full h-44 object-cover block bg-secondary"
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
          <Globe size={40} className="text-primary/30" />
        </div>
      )}
      <div className="p-3.5 border-t border-border">
        <p className="text-[11px] text-muted-foreground uppercase mb-1 tracking-wide">{domain}</p>
        <p className="text-[15px] font-bold text-foreground mb-1 leading-snug">{title}</p>
        <p className="text-sm text-muted-foreground leading-snug line-clamp-2">{desc}</p>
      </div>
    </div>
  );
}

// ─── Twitter Card Preview ─────────────────────────────────────────────────────
function TwitterCard({ scan }: { scan: SeoScan }) {
  const title  = scan.ogTitle  || scan.title  || scan.domain;
  const desc   = scan.ogDesc   || scan.metaDesc || "No description found.";
  const image  = scan.twitterImage || scan.ogImage || "";
  const domain = scan.domain.replace(/^https?:\/\//, "").split("/")[0];
  const isLarge = scan.twitterCard === "summary_large_image" || !scan.twitterCard;
  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
      {isLarge && (
        image ? (
          <img src={image} alt="twitter" className="w-full h-40 object-cover block bg-secondary"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-blue-500/10 to-blue-500/5 flex items-center justify-center">
            <Twitter size={36} className="text-blue-400/40" />
          </div>
        )
      )}
      <div className="p-3.5">
        <p className="text-[15px] font-bold text-foreground mb-1 leading-snug">{title}</p>
        <p className="text-sm text-muted-foreground mb-1.5 leading-snug line-clamp-2">{desc}</p>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Globe size={11} />{domain}</p>
      </div>
    </div>
  );
}

// ─── Ad Credits Section ───────────────────────────────────────────────────────
function AdCreditsPanel({ credits }: { credits: AdCredits }) {
  const { eligible, nextTier, progress, totalSpentBase } = credits;
  const tiers = [
    { credit: "$75",  badge: "silver",   label: "Silver Member",    threshold: 15_000,  color: "#6B7280", bg: "bg-secondary" },
    { credit: "$150", badge: "gold",     label: "Gold Member",      threshold: 45_000,  color: "#D97706", bg: "bg-amber-500/10" },
    { credit: "$500", badge: "platinum", label: "Platinum Partner", threshold: 150_000, color: "#7C3AED", bg: "bg-violet-500/10" },
  ];
  const badgeIcon = eligible?.badge === "platinum" ? "💎" : eligible?.badge === "gold" ? "🥇" : "🥈";

  return (
    <div className="flex flex-col gap-4">
      {eligible ? (
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
          className="border-2 rounded-2xl p-5"
          style={{ borderColor: eligible.color + "40", backgroundColor: eligible.color + "0D" }}>
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl flex items-center justify-center text-[26px] shrink-0"
              style={{ backgroundColor: eligible.color + "20" }}>
              {badgeIcon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base font-black" style={{ color: eligible.color }}>{eligible.label}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-white"
                  style={{ backgroundColor: eligible.color }}>ELIGIBLE</span>
              </div>
              <p className="text-sm text-muted-foreground">{eligible.desc}</p>
            </div>
            <div className="text-center shrink-0">
              <p className="text-[28px] font-black leading-none" style={{ color: eligible.color }}>{eligible.credit}</p>
              <p className="text-[10px] text-muted-foreground">Ad Credit</p>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="bg-secondary/40 border border-dashed border-border rounded-2xl p-5 text-center">
          <div className="text-3xl mb-2">🏆</div>
          <p className="text-[15px] font-bold text-foreground mb-1">Not Yet Eligible</p>
          <p className="text-sm text-muted-foreground">
            Spend Rs. {(15_000 - totalSpentBase).toLocaleString()} more to unlock your first $75 Google Ads Credit.
          </p>
        </div>
      )}

      {nextTier && !eligible?.badge && (
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-foreground">Progress to {nextTier.label}</span>
            <span className="text-sm font-black text-primary">{progress}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 text-right">
            Rs. {totalSpentBase.toLocaleString()} / Rs. {nextTier.threshold.toLocaleString()}
          </p>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 bg-secondary/30">
          <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Reward Tiers</p>
        </div>
        {tiers.map((t, i) => {
          const unlocked = totalSpentBase >= t.threshold;
          return (
            <div key={t.badge}
              className={`flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0 ${unlocked ? "opacity-100" : "opacity-50"}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.bg}`}>
                <Trophy size={16} style={{ color: t.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{t.label}</p>
                <p className="text-[11px] text-muted-foreground">Spend Rs. {t.threshold.toLocaleString()}</p>
              </div>
              <span className="text-sm font-black" style={{ color: t.color }}>{t.credit}</span>
              {unlocked && <CheckCircle2 size={16} className="text-green-500" />}
            </div>
          );
        })}
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">How it works:</strong> Google Ads Credits are based on your total payments to us. Once eligible, contact support to claim. Credits are subject to Google's promotional terms.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GrowthSuite() {
  const [tab, setTab]       = useState<"seo" | "social" | "ads" | "keywords">("seo");
  const [domain, setDomain] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scan, setScan]     = useState<SeoScan | null>(null);
  const [scanErr, setScanErr] = useState("");
  const [socialNet, setSocialNet] = useState<"facebook" | "twitter">("facebook");

  const { data: domainsData } = useQuery<{ domains: Domain[] }>({
    queryKey: ["my-growth-domains"],
    queryFn: () => fetch("/api/my/growth/domains", { headers: authHeaders() }).then(r => r.json()),
    staleTime: 60_000,
  });
  const { data: savedScans } = useQuery<{ scans: SeoScan[] }>({
    queryKey: ["my-growth-seo-results"],
    queryFn: () => fetch("/api/my/growth/seo-results", { headers: authHeaders() }).then(r => r.json()),
    staleTime: 60_000,
  });
  const { data: adCredits, isLoading: adsLoading } = useQuery<AdCredits>({
    queryKey: ["my-growth-ad-credits"],
    queryFn: () => fetch("/api/my/growth/ad-credits", { headers: authHeaders() }).then(r => r.json()),
    staleTime: 120_000,
  });

  const domains      = domainsData?.domains ?? [];
  const previousScan = savedScans?.scans?.find(s => s.domain === domain) ?? savedScans?.scans?.[0] ?? null;
  const activeScan   = scan ?? previousScan;

  const handleScan = async () => {
    if (!domain) return;
    setScanning(true); setScanErr("");
    try {
      const r = await fetch("/api/my/growth/seo-scan", {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ domain }),
      });
      const d = await r.json();
      if (!r.ok) { setScanErr(d.error || "We couldn't reach that domain. Please double-check the URL and try again."); setScanning(false); return; }
      setScan(d);
    } catch { setScanErr("Connection error — please check your internet and try again."); }
    setScanning(false);
  };

  const seoChecks = activeScan ? [
    { ok: activeScan.httpsOk,       label: "HTTPS / SSL",      value: activeScan.httpsOk ? "Secure" : undefined,   tip: "Install an SSL certificate so your site loads over HTTPS. This is free with Let's Encrypt and required by Google." },
    { ok: !!activeScan.title,       label: "Page Title",        value: activeScan.title ? activeScan.title.slice(0, 50) : undefined, tip: "Add a <title> tag to your page. It shows in search results and browser tabs." },
    { ok: !!activeScan.metaDesc,    label: "Meta Description",  value: activeScan.metaDesc ? activeScan.metaDesc.slice(0, 50) + "…" : undefined, tip: 'Add <meta name="description" content="..."> to describe your page in 155 characters.' },
    { ok: !!activeScan.ogTitle,     label: "Open Graph Title",  value: activeScan.ogTitle ? activeScan.ogTitle.slice(0, 45) : undefined, tip: 'Add <meta property="og:title" content="..."> so social shares look great.' },
    { ok: !!activeScan.ogImage,     label: "Open Graph Image",  value: activeScan.ogImage ? "Found" : undefined, tip: 'Add <meta property="og:image" content="..."> with a 1200×630px image for rich social previews.' },
    { ok: activeScan.sitemapOk,     label: "Sitemap.xml",       value: activeScan.sitemapOk ? "Found" : undefined, tip: "Create a /sitemap.xml and submit it to Google Search Console so pages get indexed faster." },
    { ok: activeScan.robotsOk,      label: "Robots.txt",        value: activeScan.robotsOk ? "Found" : undefined, tip: "Add a /robots.txt file to guide search engine crawlers on which pages to index." },
    { ok: !!activeScan.canonical,   label: "Canonical URL",     value: activeScan.canonical ? "Set" : undefined, tip: 'Add <link rel="canonical" href="..."> to prevent duplicate content penalties.' },
    { ok: activeScan.viewportOk,    label: "Mobile Viewport",   value: activeScan.viewportOk ? "Set" : undefined, tip: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> for mobile-friendly pages.' },
    { ok: activeScan.h1Count === 1, label: "Single H1 Tag",     value: activeScan.h1Count > 0 ? `${activeScan.h1Count} found` : undefined, tip: "Your page should have exactly one <h1> tag. Multiple or missing H1s confuse search engines." },
  ] : [];

  const tabs = [
    { id: "seo",      label: "SEO Toolkit",    icon: Search     },
    { id: "social",   label: "Social Preview", icon: Share2     },
    { id: "ads",      label: "Ad Credits",     icon: BadgeCheck },
    { id: "keywords", label: "Keywords",       icon: Target     },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <TrendingUp size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground leading-tight">Growth Suite</h1>
          <p className="text-sm text-muted-foreground">SEO, social sharing, and ad credit tools for your business.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-secondary/60 border border-border/60 rounded-2xl p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
              tab === t.id
                ? "bg-card border-border/60 text-primary shadow-sm"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon size={13} className="shrink-0" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Domain Scanner Bar (SEO + Social) ── */}
      {(tab === "seo" || tab === "social") && (
        <div className="bg-card border border-border rounded-2xl px-4 py-3.5 mb-5 flex items-center gap-2.5 flex-wrap">
          {domains.length > 0 ? (
            <select value={domain} onChange={e => setDomain(e.target.value)}
              className="flex-1 min-w-[180px] px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:border-primary/60 transition-all cursor-pointer">
              <option value="">— Select a domain —</option>
              {domains.map(d => <option key={d.id} value={d.domain ?? ""}>{d.domain}</option>)}
            </select>
          ) : null}
          {domains.length > 0 ? (
            <input value={domain} onChange={e => setDomain(e.target.value)}
              placeholder="Or type any domain…"
              className="flex-1 min-w-[160px] px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:border-primary/60 transition-all" />
          ) : (
            <input value={domain} onChange={e => setDomain(e.target.value)}
              placeholder="yourwebsite.com"
              className="flex-1 min-w-[200px] px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:border-primary/60 transition-all" />
          )}
          <button onClick={handleScan} disabled={scanning || !domain}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer flex items-center gap-1.5 transition-all ${
              domain ? "bg-primary hover:bg-primary/90 text-white" : "bg-secondary text-muted-foreground cursor-default"
            } disabled:opacity-70`}>
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {scanning ? "Scanning…" : activeScan?.domain === domain ? "Re-scan" : "Scan Site"}
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* ── SEO TOOLKIT ── */}
        {tab === "seo" && (
          <motion.div key="seo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {scanErr && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive">
                {scanErr}
              </div>
            )}

            {scanning && (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
              </div>
            )}

            {!activeScan && !scanning && (
              <div className="bg-card border border-border rounded-2xl py-13 px-6 text-center">
                <div className="w-15 h-15 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Search size={26} className="text-primary/40" />
                </div>
                <p className="font-bold text-foreground text-[15px] mb-1.5">Run your first SEO scan</p>
                <p className="text-sm text-muted-foreground">Enter your domain above and click Scan Site to get your SEO score and a detailed checklist.</p>
              </div>
            )}

            {activeScan && !scanning && (
              <div className="space-y-4">
                {/* Score card */}
                <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-5">
                  <ScoreRing score={activeScan.score} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xl font-black text-foreground truncate">{activeScan.domain}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black"
                        style={{ background: scoreColor(activeScan.score) + "22", color: scoreColor(activeScan.score) }}>
                        {scoreLabel(activeScan.score)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Last scanned {timeAgo(activeScan.scannedAt)} · {seoChecks.filter(c => c.ok).length}/{seoChecks.length} checks passed
                    </p>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden max-w-[280px]">
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ background: `linear-gradient(90deg, ${scoreColor(activeScan.score)}, ${scoreColor(activeScan.score)}aa)`, width: `${activeScan.score}%` }} />
                    </div>
                  </div>
                  {!activeScan.fetchOk && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2 shrink-0">
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">⚠ Site unreachable</p>
                    </div>
                  )}
                </div>

                {/* Checklist */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-secondary/30">
                    <span className="text-sm font-black text-foreground">SEO Checklist</span>
                    <span className="text-xs text-muted-foreground">Click a failed item for a fix tip</span>
                  </div>
                  {seoChecks.map(c => (
                    <CheckRow key={c.label} ok={c.ok} label={c.label} value={c.value} tip={c.tip} />
                  ))}
                </div>

                {/* Saved scans */}
                {(savedScans?.scans?.length ?? 0) > 1 && (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border/60 bg-secondary/30">
                      <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Previously Scanned</span>
                    </div>
                    {savedScans!.scans.map(s => (
                      <div key={s.domain}
                        onClick={() => { setDomain(s.domain); setScan(s); }}
                        className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0 cursor-pointer hover:bg-secondary/30 transition-colors">
                        <Globe size={13} className="text-muted-foreground shrink-0" />
                        <span className="flex-1 text-sm font-semibold text-foreground">{s.domain}</span>
                        <span className="text-[11px] font-black" style={{ color: scoreColor(s.score) }}>{s.score}/100</span>
                        <span className="text-[11px] text-muted-foreground/60">{timeAgo(s.scannedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── SOCIAL PREVIEW ── */}
        {tab === "social" && (
          <motion.div key="social" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {!activeScan ? (
              <div className="bg-card border border-border rounded-2xl py-13 px-6 text-center">
                <div className="w-15 h-15 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Share2 size={26} className="text-primary/40" />
                </div>
                <p className="font-bold text-foreground text-[15px] mb-1.5">No scan data yet</p>
                <p className="text-sm text-muted-foreground">Run an SEO scan first to preview how your site looks when shared on social media.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Network switcher */}
                <div className="flex gap-2">
                  {[
                    { id: "facebook", label: "Facebook",   icon: Facebook, color: "#1877F2" },
                    { id: "twitter",  label: "Twitter / X", icon: Twitter,  color: "#1DA1F2" },
                  ].map(n => (
                    <button key={n.id} onClick={() => setSocialNet(n.id as any)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-bold text-sm cursor-pointer transition-all ${
                        socialNet === n.id ? "" : "border-border text-muted-foreground bg-transparent"
                      }`}
                      style={socialNet === n.id ? {
                        borderColor: n.color,
                        color: n.color,
                        backgroundColor: n.color + "18",
                      } : {}}>
                      <n.icon size={15} />{n.label}
                    </button>
                  ))}
                </div>

                {/* Preview card */}
                <div className={`rounded-2xl p-5 max-w-[500px] mx-auto w-full ${socialNet === "facebook" ? "bg-[#F0F2F5] dark:bg-[#18191A]" : "bg-black"}`}>
                  <p className={`text-[11px] font-bold mb-3 uppercase tracking-widest ${socialNet === "facebook" ? "text-[#65676B] dark:text-[#B0B3B8]" : "text-[#71767B]"}`}>
                    {socialNet === "facebook" ? "Facebook" : "Twitter"} Preview
                  </p>
                  {socialNet === "facebook"
                    ? <FacebookCard scan={activeScan} />
                    : <TwitterCard  scan={activeScan} />}
                </div>

                {/* OG tag status */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-secondary/30 border-b border-border/60">
                    <span className="text-sm font-black text-foreground">Open Graph Tags</span>
                  </div>
                  <CheckRow ok={!!activeScan.ogTitle}     label="og:title"       value={activeScan.ogTitle?.slice(0,50)} tip='Add <meta property="og:title" content="Your Page Title">' />
                  <CheckRow ok={!!activeScan.ogDesc}      label="og:description" value={activeScan.ogDesc?.slice(0,50)}  tip='Add <meta property="og:description" content="…">' />
                  <CheckRow ok={!!activeScan.ogImage}     label="og:image"       value={activeScan.ogImage ? "Set" : undefined} tip="Add a 1200×630px og:image for rich link previews on all platforms." />
                  <CheckRow ok={!!activeScan.twitterCard}   label="twitter:card"  value={activeScan.twitterCard || undefined} tip='Add <meta name="twitter:card" content="summary_large_image"> for large Twitter previews.' />
                  <CheckRow ok={!!activeScan.twitterImage}  label="twitter:image" value={activeScan.twitterImage ? "Set" : undefined} tip='Add <meta name="twitter:image" content="…"> for a custom Twitter preview image.' />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── AD CREDITS ── */}
        {tab === "ads" && (
          <motion.div key="ads" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {adsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-36 w-full rounded-xl" />
              </div>
            ) : adCredits ? (
              <AdCreditsPanel credits={adCredits} />
            ) : null}
          </motion.div>
        )}

        {/* ── KEYWORD TRACKER ── */}
        {tab === "keywords" && (
          <motion.div key="keywords" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <KeywordTrackerTab />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ─── Keyword Tracker Tab ──────────────────────────────────────────────────────
function KeywordTrackerTab() {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [domain, setDomain]   = useState("");
  const [addErr, setAddErr]   = useState("");
  const [checking, setChecking] = useState<number | null>(null);

  interface KwRow {
    id: number; keyword: string; domain: string; created_at: string;
    position: number | null; url: string | null; checked_at: string | null;
  }

  const { data: keywords = [], isLoading } = useQuery<KwRow[]>({
    queryKey: ["my-keywords"],
    queryFn: () => fetch("/api/my/keywords", { headers: { Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("noehost_token") || ""}` } }).then(r => r.json()),
    staleTime: 30_000,
  });

  const addMut = useMutation({
    mutationFn: async (body: { keyword: string; domain: string }) => {
      const r = await fetch("/api/my/keywords", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("noehost_token") || ""}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to add");
      return j;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-keywords"] }); setKeyword(""); setDomain(""); setAddErr(""); },
    onError: (e: any) => setAddErr(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/my/keywords/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("noehost_token") || ""}` } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-keywords"] }),
  });

  const checkMut = useMutation({
    mutationFn: async (id: number) => {
      setChecking(id);
      const r = await fetch(`/api/my/keywords/${id}/check`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("noehost_token") || ""}` } });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-keywords"] }); setChecking(null); },
    onError: () => setChecking(null),
  });

  function posColor(p: number | null) {
    if (p === null) return "#9CA3AF";
    if (p <= 10)  return "#10B981";
    if (p <= 30)  return "#F59E0B";
    return "#EF4444";
  }
  function posLabel(p: number | null) {
    if (p === null) return "Not checked";
    if (p <= 3)   return "Top 3 🏆";
    if (p <= 10)  return "Page 1";
    if (p <= 20)  return "Page 2";
    if (p <= 50)  return "Page 5";
    return `Position ${p}`;
  }

  const canAdd = keywords.length < 5;

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="bg-primary/10 border border-primary/20 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-2.5 mb-1.5">
          <Target size={18} className="text-primary shrink-0" />
          <span className="text-[15px] font-black text-foreground">Keyword Rank Tracker</span>
          <span className="ml-auto px-2.5 py-0.5 rounded-full bg-primary text-white text-[11px] font-bold">
            {keywords.length}/5 Keywords
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Track up to 5 keywords for your website. Click "Check Rank" to see your estimated Google position.
        </p>
      </div>

      {/* Add keyword form */}
      {canAdd && (
        <div className="bg-card border border-border rounded-2xl px-5 py-4">
          <p className="text-sm font-black text-foreground mb-3">Add a Keyword to Track</p>
          <div className="flex gap-2 flex-wrap">
            <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="e.g. cheap hosting pakistan"
              className="flex-[2] min-w-[180px] px-3 py-2.5 border border-border bg-background text-foreground rounded-xl text-sm outline-none focus:border-primary/60 transition-all" />
            <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="yourdomain.com"
              className="flex-1 min-w-[140px] px-3 py-2.5 border border-border bg-background text-foreground rounded-xl text-sm outline-none focus:border-primary/60 transition-all" />
            <button onClick={() => { if (keyword && domain) addMut.mutate({ keyword, domain }); }}
              disabled={!keyword || !domain || addMut.isPending}
              className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1.5 cursor-pointer transition-all ${
                keyword && domain ? "bg-primary hover:bg-primary/90 text-white" : "bg-secondary text-muted-foreground cursor-default"
              } disabled:opacity-70`}>
              {addMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add
            </button>
          </div>
          {addErr && <p className="text-xs text-destructive mt-2">{addErr}</p>}
        </div>
      )}

      {/* Keywords list */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-2xl divide-y divide-border/40">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      ) : keywords.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-12 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Target size={24} className="text-primary/40" />
          </div>
          <p className="font-bold text-foreground text-[15px] mb-1.5">No keywords tracked yet</p>
          <p className="text-sm text-muted-foreground">Add your first keyword above to start tracking your Google position.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-[1fr_130px_110px_100px_80px] gap-2 px-4 py-2.5 border-b border-border/60 bg-secondary/30">
            {["Keyword", "Domain", "Position", "Checked", ""].map(h => (
              <span key={h} className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-border/40">
            {keywords.map(kw => (
              <div key={kw.id} className="grid grid-cols-[1fr_130px_110px_100px_80px] gap-2 items-center px-4 py-3.5">
                <div>
                  <p className="text-sm font-bold text-foreground">{kw.keyword}</p>
                </div>
                <span className="text-xs text-muted-foreground truncate">{kw.domain}</span>
                <div>
                  {kw.position !== null ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-black" style={{ color: posColor(kw.position) }}>#{kw.position}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: posColor(kw.position) + "22", color: posColor(kw.position) }}>
                        {posLabel(kw.position)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/60 italic">Not checked</span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {kw.checked_at ? new Date(kw.checked_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}
                </span>
                <div className="flex gap-1.5">
                  <button onClick={() => checkMut.mutate(kw.id)} disabled={checking === kw.id}
                    className="px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-[11px] font-bold text-primary cursor-pointer hover:bg-primary/20 transition-colors whitespace-nowrap">
                    {checking === kw.id ? <Loader2 size={11} className="animate-spin" /> : "Check"}
                  </button>
                  <button onClick={() => deleteMut.mutate(kw.id)}
                    className="p-1.5 rounded-lg border border-border bg-card hover:bg-destructive/10 cursor-pointer transition-colors">
                    <Trash2 size={12} className="text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!canAdd && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <strong>5/5 keywords used.</strong> Remove a keyword to add a new one. Upgrade your plan for unlimited tracking.
          </p>
        </div>
      )}

      <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Note:</strong> Positions are estimated based on available signals. For precise rank tracking, connect Google Search Console or use a professional SERP API.
        </p>
      </div>
    </div>
  );
}
