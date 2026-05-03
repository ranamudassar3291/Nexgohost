import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp, Search, Share2, BadgeCheck, Loader2, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, Globe, ChevronDown,
  Facebook, Twitter, Sparkles, Trophy, Star, Zap, ExternalLink,
  FileText, MapPin, Shield, Smartphone, Link2, AlignLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const t = localStorage.getItem("token");
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
  const color  = ok === null ? "#9CA3AF" : ok ? "#10B981" : "#EF4444";
  const Icon   = ok === null ? AlertCircle : ok ? CheckCircle2 : XCircle;
  return (
    <div style={{ borderBottom: "1px solid #F9FAFB" }}>
      <div style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 10, cursor: tip ? "pointer" : "default" }}
           onClick={() => tip && setOpen(o => !o)}>
        <Icon size={15} color={color} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#374151" }}>{label}</span>
        {value && (
          <span style={{ fontSize: 11, color: "#9CA3AF", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
        )}
        {!ok && tip && <ChevronDown size={12} color="#9CA3AF" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />}
      </div>
      {open && tip && !ok && (
        <div style={{ margin: "0 16px 10px 41px", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#92400E" }}>
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
    <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
      <svg style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#F3F4F6" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - dash}
          style={{ transition: "stroke-dashoffset 1.2s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, color: "#94A3B8", fontWeight: 600 }}>/ 100</span>
      </div>
    </div>
  );
}

// ─── Facebook Card Preview ────────────────────────────────────────────────────
function FacebookCard({ scan }: { scan: SeoScan }) {
  const title   = scan.ogTitle   || scan.title   || scan.domain;
  const desc    = scan.ogDesc    || scan.metaDesc || "No description found.";
  const image   = scan.ogImage   || "";
  const domain  = scan.domain.replace(/^https?:\/\//, "").split("/")[0];
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #E5E7EB", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
      {image ? (
        <img src={image} alt="og" style={{ width: "100%", height: 180, objectFit: "cover", display: "block", background: "#F3F4F6" }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <div style={{ width: "100%", height: 180, background: "linear-gradient(135deg,#EEF2FF,#E0E7FF)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Globe size={40} color="#A5B4FC" />
        </div>
      )}
      <div style={{ padding: "12px 14px", borderTop: "1px solid #F3F4F6" }}>
        <p style={{ fontSize: 11, color: "#9CA3AF", textTransform: "uppercase", margin: "0 0 4px" }}>{domain}</p>
        <p style={{ fontSize: 15, fontWeight: 800, color: "#1C2433", margin: "0 0 4px", lineHeight: 1.3 }}>{title}</p>
        <p style={{ fontSize: 13, color: "#606770", margin: 0, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{desc}</p>
      </div>
    </div>
  );
}

// ─── Twitter Card Preview ─────────────────────────────────────────────────────
function TwitterCard({ scan }: { scan: SeoScan }) {
  const title  = scan.ogTitle   || scan.title   || scan.domain;
  const desc   = scan.ogDesc    || scan.metaDesc || "No description found.";
  const image  = scan.twitterImage || scan.ogImage || "";
  const domain = scan.domain.replace(/^https?:\/\//, "").split("/")[0];
  const isLarge = scan.twitterCard === "summary_large_image" || !scan.twitterCard;
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #E5E7EB", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
      {isLarge ? (
        image ? (
          <img src={image} alt="twitter" style={{ width: "100%", height: 160, objectFit: "cover", display: "block", background: "#F3F4F6" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div style={{ width: "100%", height: 160, background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Twitter size={36} color="#93C5FD" />
          </div>
        )
      ) : null}
      <div style={{ padding: "12px 14px" }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: "#0F1419", margin: "0 0 4px", lineHeight: 1.3 }}>{title}</p>
        <p style={{ fontSize: 13, color: "#536471", margin: "0 0 6px", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{desc}</p>
        <p style={{ fontSize: 11, color: "#8899A6", margin: 0, display: "flex", alignItems: "center", gap: 4 }}><Globe size={11} />{domain}</p>
      </div>
    </div>
  );
}

// ─── Ad Credits Section ───────────────────────────────────────────────────────
function AdCreditsPanel({ credits }: { credits: AdCredits }) {
  const { eligible, nextTier, progress, paidInvoiceCount, totalSpentBase } = credits;
  const tiers = [
    { credit: "$75",  badge: "silver",   label: "Silver Member", threshold: 15_000, color: "#6B7280", bg: "#F3F4F6" },
    { credit: "$150", badge: "gold",     label: "Gold Member",   threshold: 45_000, color: "#D97706", bg: "#FFFBEB" },
    { credit: "$500", badge: "platinum", label: "Platinum Partner", threshold: 150_000, color: "#7C3AED", bg: "#EDE9FE" },
  ];
  const badgeIcon = eligible?.badge === "platinum" ? "💎" : eligible?.badge === "gold" ? "🥇" : "🥈";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Eligible badge */}
      {eligible ? (
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
          style={{ background: `linear-gradient(135deg,${eligible.bg},${eligible.bg})`, border: `2px solid ${eligible.color}30`, borderRadius: 18, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: eligible.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
              {badgeIcon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: eligible.color }}>{eligible.label}</span>
                <span style={{ padding: "2px 8px", borderRadius: 20, background: eligible.color, color: "#fff", fontSize: 10, fontWeight: 800 }}>ELIGIBLE</span>
              </div>
              <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>{eligible.desc}</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 900, color: eligible.color, margin: 0 }}>{eligible.credit}</p>
              <p style={{ fontSize: 10, color: "#9CA3AF", margin: 0 }}>Ad Credit</p>
            </div>
          </div>
        </motion.div>
      ) : (
        <div style={{ background: "#F8FAFC", border: "1px dashed #CBD5E1", borderRadius: 18, padding: "20px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#374151", margin: "0 0 4px" }}>Not Yet Eligible</p>
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>
            Spend Rs. {(15_000 - totalSpentBase).toLocaleString()} more to unlock your first $75 Google Ads Credit.
          </p>
        </div>
      )}

      {/* Progress to next tier */}
      {nextTier && !eligible?.badge && (
        <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Progress to {nextTier.label}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#4F46E5" }}>{progress}%</span>
          </div>
          <div style={{ height: 8, background: "#F3F4F6", borderRadius: 8, overflow: "hidden" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1.2, ease: "easeOut" }}
              style={{ height: "100%", borderRadius: 8, background: "linear-gradient(90deg,#6366F1,#8B5CF6)" }} />
          </div>
          <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6, textAlign: "right" }}>
            Rs. {totalSpentBase.toLocaleString()} / Rs. {nextTier.threshold.toLocaleString()}
          </p>
        </div>
      )}

      {/* Tier ladder */}
      <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6", background: "#FAFBFF" }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>Reward Tiers</p>
        </div>
        {tiers.map((t, i) => {
          const unlocked = totalSpentBase >= t.threshold;
          return (
            <div key={t.badge} style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: i < tiers.length - 1 ? "1px solid #F9FAFB" : "none", opacity: unlocked ? 1 : 0.55 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Trophy size={16} color={t.color} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{t.label}</p>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>Spend Rs. {t.threshold.toLocaleString()}</p>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: t.color }}>{t.credit}</span>
              {unlocked && <CheckCircle2 size={16} color="#10B981" />}
            </div>
          );
        })}
      </div>

      <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "12px 16px" }}>
        <p style={{ fontSize: 12, color: "#1E40AF", margin: 0 }}>
          <strong>How it works:</strong> Google Ads Credits are based on your total payments to us. Once eligible, contact our support team to claim your credit. Credits are subject to Google's promotional terms.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GrowthSuite() {
  const [tab, setTab]       = useState<"seo" | "social" | "ads">("seo");
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
      if (!r.ok) { setScanErr(d.error || "Scan failed"); setScanning(false); return; }
      setScan(d);
    } catch { setScanErr("Network error — please try again."); }
    setScanning(false);
  };

  const seoChecks = activeScan ? [
    { ok: activeScan.httpsOk,    label: "HTTPS / SSL",        value: activeScan.httpsOk ? "Secure" : undefined, tip: "Install an SSL certificate so your site loads over HTTPS. This is free with Let's Encrypt and required by Google." },
    { ok: !!activeScan.title,    label: "Page Title",         value: activeScan.title ? activeScan.title.slice(0, 50) : undefined, tip: "Add a <title> tag to your page. It shows in search results and browser tabs." },
    { ok: !!activeScan.metaDesc, label: "Meta Description",   value: activeScan.metaDesc ? activeScan.metaDesc.slice(0, 50) + "…" : undefined, tip: 'Add <meta name="description" content="..."> to describe your page in 155 characters.' },
    { ok: !!activeScan.ogTitle,  label: "Open Graph Title",   value: activeScan.ogTitle ? activeScan.ogTitle.slice(0, 45) : undefined, tip: 'Add <meta property="og:title" content="..."> so social shares look great.' },
    { ok: !!activeScan.ogImage,  label: "Open Graph Image",   value: activeScan.ogImage ? "Found" : undefined, tip: 'Add <meta property="og:image" content="..."> with a 1200×630px image for rich social previews.' },
    { ok: activeScan.sitemapOk,  label: "Sitemap.xml",        value: activeScan.sitemapOk ? "Found" : undefined, tip: "Create a /sitemap.xml file and submit it to Google Search Console so your pages get indexed faster." },
    { ok: activeScan.robotsOk,   label: "Robots.txt",         value: activeScan.robotsOk ? "Found" : undefined, tip: "Add a /robots.txt file to guide search engine crawlers on which pages to index." },
    { ok: !!activeScan.canonical,label: "Canonical URL",      value: activeScan.canonical ? "Set" : undefined, tip: 'Add <link rel="canonical" href="..."> to prevent duplicate content penalties.' },
    { ok: activeScan.viewportOk, label: "Mobile Viewport",    value: activeScan.viewportOk ? "Set" : undefined, tip: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> for mobile-friendly pages.' },
    { ok: activeScan.h1Count === 1, label: "Single H1 Tag",   value: activeScan.h1Count > 0 ? `${activeScan.h1Count} found` : undefined, tip: "Your page should have exactly one <h1> tag. Multiple or missing H1s confuse search engines." },
  ] : [];

  const tabs = [
    { id: "seo",    label: "SEO Toolkit",      icon: Search     },
    { id: "social", label: "Social Preview",   icon: Share2     },
    { id: "ads",    label: "Ad Credits",       icon: BadgeCheck },
  ] as const;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg,#EEF2FF,#E0E7FF)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TrendingUp size={18} color="#4F46E5" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Growth Suite</h1>
          <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>SEO, social sharing, and ad credit tools for your business.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 22, background: "#F3F4F6", borderRadius: 14, padding: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13, transition: "all 0.2s",
              background: tab === t.id ? "#fff" : "transparent",
              color: tab === t.id ? "#4F46E5" : "#6B7280",
              boxShadow: tab === t.id ? "0 1px 6px rgba(0,0,0,0.10)" : "none" }}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* ── Domain Scanner Bar (SEO + Social) ── */}
      {(tab === "seo" || tab === "social") && (
        <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 16, padding: "14px 16px", marginBottom: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Domain picker */}
          {domains.length > 0 ? (
            <select value={domain} onChange={e => setDomain(e.target.value)}
              style={{ flex: 1, minWidth: 180, padding: "9px 12px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, outline: "none", color: "#374151", background: "#F9FAFB" }}>
              <option value="">— Select a domain —</option>
              {domains.map(d => <option key={d.id} value={d.domain ?? ""}>{d.domain}</option>)}
            </select>
          ) : (
            <input value={domain} onChange={e => setDomain(e.target.value)}
              placeholder="yourwebsite.com"
              style={{ flex: 1, minWidth: 200, padding: "9px 12px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, outline: "none", color: "#374151" }} />
          )}
          {domains.length > 0 && (
            <input value={domain} onChange={e => setDomain(e.target.value)}
              placeholder="Or type any domain…"
              style={{ flex: 1, minWidth: 160, padding: "9px 12px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, outline: "none", color: "#374151" }} />
          )}
          <button onClick={handleScan} disabled={scanning || !domain}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: domain ? "#4F46E5" : "#E5E7EB", color: domain ? "#fff" : "#9CA3AF", fontWeight: 700, fontSize: 13, cursor: domain ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}>
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {scanning ? "Scanning…" : activeScan?.domain === domain ? "Re-scan" : "Scan Site"}
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* ── SEO TOOLKIT ── */}
        {tab === "seo" && (
          <motion.div key="seo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {scanErr && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "12px 16px", marginBottom: 14, color: "#DC2626", fontSize: 13 }}>
                {scanErr}
              </div>
            )}

            {!activeScan && !scanning && (
              <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 18, padding: "52px 24px", textAlign: "center" }}>
                <div style={{ width: 60, height: 60, borderRadius: 18, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <Search size={26} color="#A5B4FC" />
                </div>
                <p style={{ fontWeight: 700, color: "#374151", fontSize: 15, marginBottom: 6 }}>Run your first SEO scan</p>
                <p style={{ fontSize: 13, color: "#9CA3AF" }}>Enter your domain above and click Scan Site to get your SEO score and a detailed checklist.</p>
              </div>
            )}

            {activeScan && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Score card */}
                <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 18, padding: "18px 20px", display: "flex", alignItems: "center", gap: 18 }}>
                  <ScoreRing score={activeScan.score} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 900, color: "#111827" }}>{activeScan.domain}</span>
                      <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: scoreColor(activeScan.score) + "20", color: scoreColor(activeScan.score) }}>
                        {scoreLabel(activeScan.score)}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 10px" }}>
                      Last scanned {timeAgo(activeScan.scannedAt)} · {seoChecks.filter(c => c.ok).length}/{seoChecks.length} checks passed
                    </p>
                    <div style={{ height: 7, background: "#F3F4F6", borderRadius: 8, overflow: "hidden", maxWidth: 280 }}>
                      <div style={{ height: "100%", borderRadius: 8, background: `linear-gradient(90deg,${scoreColor(activeScan.score)},${scoreColor(activeScan.score)}aa)`, width: `${activeScan.score}%`, transition: "width 1s ease" }} />
                    </div>
                  </div>
                  {!activeScan.fetchOk && (
                    <div style={{ padding: "8px 12px", borderRadius: 10, background: "#FFF7ED", border: "1px solid #FDE68A" }}>
                      <p style={{ fontSize: 11, color: "#92400E", margin: 0, fontWeight: 600 }}>⚠ Site unreachable</p>
                    </div>
                  )}
                </div>

                {/* Checklist */}
                <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 18, overflow: "hidden" }}>
                  <div style={{ padding: "13px 16px", borderBottom: "1px solid #F3F4F6", background: "#FAFBFF", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>SEO Checklist</span>
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>Click a failed item for a fix tip</span>
                  </div>
                  {seoChecks.map(c => (
                    <CheckRow key={c.label} ok={c.ok} label={c.label} value={c.value} tip={c.tip} />
                  ))}
                </div>

                {/* Saved scans list */}
                {(savedScans?.scans?.length ?? 0) > 1 && (
                  <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 14, overflow: "hidden" }}>
                    <div style={{ padding: "10px 16px", borderBottom: "1px solid #F3F4F6", background: "#FAFBFF" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>Previously scanned</span>
                    </div>
                    {savedScans!.scans.map(s => (
                      <div key={s.domain} onClick={() => { setDomain(s.domain); setScan(s); }}
                        style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #F9FAFB", cursor: "pointer" }}>
                        <Globe size={13} color="#9CA3AF" />
                        <span style={{ flex: 1, fontSize: 13, color: "#374151", fontWeight: 600 }}>{s.domain}</span>
                        <span style={{ fontSize: 11, color: scoreColor(s.score), fontWeight: 800 }}>{s.score}/100</span>
                        <span style={{ fontSize: 11, color: "#D1D5DB" }}>{timeAgo(s.scannedAt)}</span>
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
              <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 18, padding: "52px 24px", textAlign: "center" }}>
                <div style={{ width: 60, height: 60, borderRadius: 18, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <Share2 size={26} color="#A5B4FC" />
                </div>
                <p style={{ fontWeight: 700, color: "#374151", fontSize: 15, marginBottom: 6 }}>No scan data yet</p>
                <p style={{ fontSize: 13, color: "#9CA3AF" }}>Run an SEO scan first to see how your site appears when shared on social media.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Network switcher */}
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { id: "facebook", label: "Facebook", icon: Facebook, color: "#1877F2", bg: "#EFF4FF" },
                    { id: "twitter",  label: "Twitter / X", icon: Twitter,  color: "#1DA1F2", bg: "#E8F4FD" },
                  ].map(n => (
                    <button key={n.id} onClick={() => setSocialNet(n.id as any)}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px", borderRadius: 12, border: `2px solid ${socialNet === n.id ? n.color : "#E5E7EB"}`, background: socialNet === n.id ? n.bg : "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13, color: socialNet === n.id ? n.color : "#6B7280" }}>
                      <n.icon size={15} />{n.label}
                    </button>
                  ))}
                </div>

                {/* Preview card */}
                <div style={{ background: socialNet === "facebook" ? "#F0F2F5" : "#000", borderRadius: 18, padding: "20px", maxWidth: 500, margin: "0 auto", width: "100%" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: socialNet === "facebook" ? "#65676B" : "#71767B", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {socialNet === "facebook" ? "Facebook" : "Twitter"} Preview
                  </p>
                  {socialNet === "facebook"
                    ? <FacebookCard scan={activeScan} />
                    : <TwitterCard  scan={activeScan} />}
                </div>

                {/* OG tag status */}
                <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", background: "#FAFBFF", borderBottom: "1px solid #F3F4F6" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>Open Graph Tags</span>
                  </div>
                  <CheckRow ok={!!activeScan.ogTitle}  label="og:title"       value={activeScan.ogTitle?.slice(0,50)} tip='Add <meta property="og:title" content="Your Page Title">' />
                  <CheckRow ok={!!activeScan.ogDesc}   label="og:description" value={activeScan.ogDesc?.slice(0,50)}  tip='Add <meta property="og:description" content="…">' />
                  <CheckRow ok={!!activeScan.ogImage}  label="og:image"       value={activeScan.ogImage ? "Set" : undefined} tip="Add a 1200×630px og:image for rich link previews on all platforms." />
                  <CheckRow ok={!!activeScan.twitterCard} label="twitter:card" value={activeScan.twitterCard || undefined} tip='Add <meta name="twitter:card" content="summary_large_image"> for large Twitter previews.' />
                  <CheckRow ok={!!activeScan.twitterImage} label="twitter:image" value={activeScan.twitterImage ? "Set" : undefined} tip='Add <meta name="twitter:image" content="…"> for a custom Twitter preview image.' />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── AD CREDITS ── */}
        {tab === "ads" && (
          <motion.div key="ads" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {adsLoading ? (
              <div style={{ background: "#fff", border: "1px solid #E8EAED", borderRadius: 18, padding: 52, display: "flex", justifyContent: "center" }}>
                <Loader2 size={20} className="animate-spin" color="#C7D2FE" />
              </div>
            ) : adCredits ? (
              <AdCreditsPanel credits={adCredits} />
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
