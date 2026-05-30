import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Timer, Zap, ShieldCheck, ArrowRight, Star } from "lucide-react";

interface FlashSale {
  id: string; title: string; slug: string; headline: string; subheadline: string;
  badge_text: string; cta_text: string; cta_url: string;
  original_price: string | null; sale_price: string | null; currency: string;
  ends_at: string | null; bg_color: string; accent_color: string;
  is_active: boolean;
}

// ─── Countdown hook ───────────────────────────────────────────────────────────
function useCountdown(target: string | null) {
  const calc = () => {
    if (!target) return { d: 0, h: 0, m: 0, s: 0, expired: false };
    const diff = Math.max(0, new Date(target).getTime() - Date.now());
    if (diff === 0) return { d: 0, h: 0, m: 0, s: 0, expired: true };
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    return { d, h, m, s, expired: false };
  };
  const [time, setTime] = useState(calc());
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1_000);
    return () => clearInterval(id);
  }, [target]);
  return time;
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function Unit({ val, label, accent }: { val: number; label: string; accent: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ background: "rgba(255,255,255,.08)", border: `1px solid ${accent}44`, borderRadius: 16, padding: "20px 28px", minWidth: 80 }}>
        <span style={{ fontSize: 48, fontWeight: 900, fontFamily: "monospace", color: "#F9FAFB", display: "block", lineHeight: 1 }}>{pad(val)}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: "#9CA3AF", marginTop: 8 }}>{label}</div>
    </div>
  );
}

export default function FlashSale() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["flash-sale", slug],
    queryFn: () => fetch(`/api/flash-sales/${slug}`).then(r => { if (!r.ok) throw new Error("Not found"); return r.json(); }),
  });

  const sale: FlashSale | null = data?.flashSale || null;
  const countdown = useCountdown(sale?.ends_at || null);

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #7C5DE2", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (isError || !sale || !sale.is_active) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#F9FAFB", textAlign: "center", padding: 32 }}>
        <Zap size={56} style={{ color: "#4B5563", marginBottom: 20 }} />
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>This deal has ended</h1>
        <p style={{ color: "#9CA3AF", marginBottom: 28 }}>Check out our latest hosting plans — great deals available every day!</p>
        <Link to="/shared-hosting" style={{ background: "#7C5DE2", color: "#fff", padding: "12px 28px", borderRadius: 12, fontWeight: 700, textDecoration: "none", fontSize: 15 }}>
          See All Plans →
        </Link>
      </div>
    );
  }

  const bg      = sale.bg_color      || "#0F172A";
  const accent  = sale.accent_color  || "#7C5DE2";
  const savings = sale.original_price && sale.sale_price
    ? Math.round((1 - Number(sale.sale_price) / Number(sale.original_price)) * 100)
    : null;

  return (
    <div style={{ minHeight: "100vh", background: bg, color: "#F9FAFB", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes gradientShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        body { margin:0; }
      `}</style>

      {/* Glows */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "60%", height: "60%", borderRadius: "50%", background: `radial-gradient(circle, ${accent}33 0%, transparent 70%)`, filter: "blur(60px)" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: "50%", height: "50%", borderRadius: "50%", background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`, filter: "blur(80px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "60px 24px 80px", textAlign: "center" }}>
        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 20px",
          borderRadius: 99, border: `1px solid ${accent}55`,
          background: `${accent}22`, marginBottom: 32,
        }}>
          <Zap size={14} style={{ color: accent }} />
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: 1.5, color: accent }}>{sale.badge_text}</span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: "clamp(32px, 6vw, 60px)", fontWeight: 900, lineHeight: 1.1,
          margin: "0 0 16px",
          background: `linear-gradient(135deg, #F9FAFB 40%, ${accent})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          {sale.headline}
        </h1>
        <p style={{ fontSize: 18, color: "#94A3B8", lineHeight: 1.7, marginBottom: 48, maxWidth: 520, margin: "0 auto 48px" }}>
          {sale.subheadline}
        </p>

        {/* Price */}
        {sale.sale_price && (
          <div style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
              {sale.original_price && (
                <span style={{ fontSize: 28, color: "#64748B", textDecoration: "line-through" }}>
                  {sale.currency} {Number(sale.original_price).toFixed(2)}
                </span>
              )}
              <span style={{ fontSize: 64, fontWeight: 900, color: "#F9FAFB", lineHeight: 1 }}>
                {sale.currency} {Number(sale.sale_price).toFixed(2)}
              </span>
            </div>
            {savings && (
              <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, background: "#10B98133", border: "1px solid #10B98155", borderRadius: 99, padding: "4px 16px" }}>
                <span style={{ color: "#10B981", fontWeight: 700, fontSize: 14 }}>YOU SAVE {savings}%</span>
              </div>
            )}
          </div>
        )}

        {/* Countdown */}
        {sale.ends_at && !countdown.expired && (
          <div style={{ marginBottom: 56 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", letterSpacing: 2, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Timer size={14} style={{ animation: "pulse 1.5s ease infinite" }} />
              DEAL EXPIRES IN
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
              {countdown.d > 0 && <Unit val={countdown.d} label="DAYS"    accent={accent} />}
              <Unit val={countdown.h} label="HOURS"   accent={accent} />
              <Unit val={countdown.m} label="MINUTES" accent={accent} />
              <Unit val={countdown.s} label="SECONDS" accent={accent} />
            </div>
          </div>
        )}
        {sale.ends_at && countdown.expired && (
          <div style={{ marginBottom: 48, padding: "16px 28px", background: "#FEE2E233", border: "1px solid #FCA5A5", borderRadius: 12 }}>
            <p style={{ color: "#FCA5A5", fontWeight: 700, margin: 0 }}>⏰ This deal has expired</p>
          </div>
        )}

        {/* CTA */}
        <a href={sale.cta_url || "/shared-hosting"} style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          color: "#fff", textDecoration: "none",
          padding: "18px 40px", borderRadius: 16,
          fontWeight: 800, fontSize: 18, letterSpacing: .3,
          boxShadow: `0 8px 32px ${accent}55`,
          animation: "float 3s ease infinite",
          marginBottom: 40,
        }}>
          {sale.cta_text} <ArrowRight size={20} />
        </a>

        {/* Trust badges */}
        <div style={{ display: "flex", justifyContent: "center", gap: 28, flexWrap: "wrap", marginTop: 32 }}>
          {[
            { icon: <ShieldCheck size={16} />, text: "30-Day Money Back" },
            { icon: <Star size={16} />,        text: "4.9★ Rated Support" },
            { icon: <Zap size={16} />,         text: "99.9% Uptime SLA" },
          ].map(b => (
            <div key={b.text} style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748B", fontSize: 13, fontWeight: 500 }}>
              <span style={{ color: accent }}>{b.icon}</span> {b.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
