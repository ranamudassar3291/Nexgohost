import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";

interface ProofEvent {
  id: string;
  plan_name: string;
  city: string;
  created_at: string;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const PLAN_EMOJIS: Record<string, string> = {
  "Shared":    "🌐",
  "WordPress": "📝",
  "Reseller":  "💼",
  "VPS":       "🖥️",
  "Node":      "⚡",
  "Business":  "📦",
  "Starter":   "🚀",
  "Premium":   "⭐",
};
function planEmoji(name: string): string {
  for (const [k, v] of Object.entries(PLAN_EMOJIS)) {
    if (name.includes(k)) return v;
  }
  return "🎉";
}

// ── Fallback seed (shown while API loads or if API fails) ─────────────────────
const CITIES  = ["Karachi","Lahore","Islamabad","Rawalpindi","Faisalabad","Multan","Peshawar","Quetta","Sialkot","Gujranwala"];
const PLANS   = ["Premium Shared Hosting","Business Hosting","Starter Plan","WordPress Pro","Reseller Starter","VPS Cloud 2","Node.js Hosting","cPanel Business"];
function seedEvents(n = 20): ProofEvent[] {
  return Array.from({ length: n }, (_, i) => ({
    id:         `seed-${i}`,
    plan_name:  PLANS[i % PLANS.length],
    city:       CITIES[i % CITIES.length],
    created_at: new Date(Date.now() - i * 3_800_000).toISOString(),
  }));
}

export function SocialProofToast() {
  const [location] = useLocation();
  const [events, setEvents]       = useState<ProofEvent[]>(seedEvents());
  const [current, setCurrent]     = useState<ProofEvent | null>(null);
  const [visible, setVisible]     = useState(false);
  const [slideOut, setSlideOut]   = useState(false);
  const indexRef                  = useRef(0);
  const timerRef                  = useRef<ReturnType<typeof setTimeout>>();

  // Fetch real events from API
  useEffect(() => {
    if (!location.startsWith("/client/orders/new") && !location.startsWith("/client/checkout") && !location.startsWith("/checkout") && !location.startsWith("/cart")) return;
    fetch("/api/social-proof/feed")
      .then(r => r.json())
      .then(d => { if (d.events?.length) setEvents(d.events); })
      .catch(() => {});
  }, [location]);

  // Cycle through events
  const showNext = () => {
    if (events.length === 0) return;
    const ev = events[indexRef.current % events.length];
    indexRef.current += 1;
    setCurrent(ev);
    setSlideOut(false);
    setVisible(true);

    // Auto-hide after 5 s
    timerRef.current = setTimeout(() => {
      setSlideOut(true);
      setTimeout(() => setVisible(false), 400);
    }, 5000);
  };

  useEffect(() => {
    if (!location.startsWith("/client/orders/new") && !location.startsWith("/client/checkout") && !location.startsWith("/checkout") && !location.startsWith("/cart")) return;
    // First toast after 6 s, then every 20 s
    const initial = setTimeout(() => {
      showNext();
      const interval = setInterval(showNext, 20_000);
      return () => clearInterval(interval);
    }, 6_000);
    return () => { clearTimeout(initial); clearTimeout(timerRef.current); };
  }, [events, location]);

  const dismiss = () => {
    clearTimeout(timerRef.current);
    setSlideOut(true);
    setTimeout(() => setVisible(false), 400);
  };

  if (!visible || !current) return null;

  return (
    <>
      <style>{`
        @keyframes slideUp   { from{transform:translateY(120%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes slideDown { from{transform:translateY(0);opacity:1} to{transform:translateY(120%);opacity:0} }
      `}</style>
      <div style={{
        position: "fixed", bottom: 24, left: 24, zIndex: 88888,
        maxWidth: 330, width: "calc(100vw - 48px)",
        background: "#fff", borderRadius: 16, padding: "14px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,.14), 0 1px 4px rgba(0,0,0,.06)",
        border: "1px solid #E5E7EB",
        display: "flex", alignItems: "center", gap: 12,
        animation: `${slideOut ? "slideDown" : "slideUp"} .4s cubic-bezier(.34,1.56,.64,1) forwards`,
        pointerEvents: "all",
      }}>
        {/* Avatar / Emoji */}
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: "linear-gradient(135deg,#6B46C1,#8B5CF6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
        }}>
          {planEmoji(current.plan_name)}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>
            Someone from <span style={{ color: "#6B46C1" }}>{current.city}</span> just purchased
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {current.plan_name}
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, background: "#10B981", borderRadius: "50%", display: "inline-block" }} />
            {timeAgo(current.created_at)} · Verified purchase
          </div>
        </div>

        {/* Dismiss */}
        <button onClick={dismiss} style={{
          background: "none", border: "none", color: "#D1D5DB", cursor: "pointer",
          fontSize: 16, lineHeight: 1, padding: "2px", flexShrink: 0,
          borderRadius: 4,
        }}>✕</button>
      </div>
    </>
  );
}
