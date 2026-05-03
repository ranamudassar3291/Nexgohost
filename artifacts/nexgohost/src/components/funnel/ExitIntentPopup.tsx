import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

const DISCOUNT_CODE = "STAY10";
const POPUP_KEY     = "exit_popup_shown";
const COOLDOWN_MS   = 24 * 60 * 60 * 1000; // 24 h

function alreadyShown(): boolean {
  try {
    const ts = Number(localStorage.getItem(POPUP_KEY) || "0");
    return Date.now() - ts < COOLDOWN_MS;
  } catch { return false; }
}
function markShown() {
  try { localStorage.setItem(POPUP_KEY, String(Date.now())); } catch {}
}

async function logRecovery(payload: object) {
  try {
    await fetch("/api/cart-recovery/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {}
}

export function ExitIntentPopup() {
  const [visible, setVisible]   = useState(false);
  const [copied, setCopied]     = useState(false);
  const [closing, setClosing]   = useState(false);
  const [location]              = useLocation();
  const { user }                = useAuth();
  const triggered               = useRef(false);

  const isCheckout = location.startsWith("/client/orders/new") || location.startsWith("/client/checkout") || location.startsWith("/checkout") || location.startsWith("/cart");

  const trigger = useCallback(() => {
    if (triggered.current || alreadyShown() || !isCheckout) return;
    triggered.current = true;
    markShown();
    setVisible(true);

    logRecovery({
      user_id:       user?.id   || null,
      email:         user?.email || null,
      discount_code: DISCOUNT_CODE,
      plan_name:     null,
      cart_value:    null,
    });
  }, [isCheckout, user]);

  // ── Exit-intent detection: mouse leaves top of viewport ──
  useEffect(() => {
    if (!isCheckout) return;
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY < 10) trigger();
    };
    document.addEventListener("mouseleave", onMouseLeave);
    return () => document.removeEventListener("mouseleave", onMouseLeave);
  }, [isCheckout, trigger]);

  // ── Mobile: page-visibility / blur fallback ──
  useEffect(() => {
    if (!isCheckout) return;
    const onVisibility = () => { if (document.visibilityState === "hidden") trigger(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isCheckout, trigger]);

  const dismiss = () => {
    setClosing(true);
    setTimeout(() => { setVisible(false); setClosing(false); }, 300);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(DISCOUNT_CODE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      animation: closing ? "fadeOut .3s ease forwards" : "fadeIn .3s ease forwards",
    }}>
      <style>{`
        @keyframes fadeIn  { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
        @keyframes fadeOut { from{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(.95)} }
        @keyframes pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
      `}</style>
      <div style={{
        background: "#0F172A", borderRadius: 24, maxWidth: 520, width: "100%",
        padding: "48px 40px 40px", position: "relative", textAlign: "center",
        border: "1px solid rgba(99,102,241,.3)",
        boxShadow: "0 30px 80px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.05)",
        animation: "fadeIn .35s cubic-bezier(.34,1.56,.64,1)",
      }}>
        {/* Close */}
        <button onClick={dismiss} style={{
          position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,.07)",
          border: "none", color: "#9CA3AF", cursor: "pointer", borderRadius: "50%",
          width: 32, height: 32, fontSize: 18, lineHeight: "32px", display: "flex", alignItems: "center", justifyContent: "center",
        }}>✕</button>

        {/* Emoji + badge */}
        <div style={{ fontSize: 52, marginBottom: 12 }}>🎁</div>
        <div style={{ display: "inline-block", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", padding: "4px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: 1, marginBottom: 16 }}>
          WAIT — EXCLUSIVE OFFER
        </div>

        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#F9FAFB", lineHeight: 1.2, margin: "0 0 12px" }}>
          Don't leave without your <span style={{ color: "#818CF8" }}>10% discount!</span>
        </h2>
        <p style={{ color: "#9CA3AF", fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>
          We noticed you were about to leave. Complete your order in the next 15 minutes and save 10% — just copy the code below.
        </p>

        {/* Code box */}
        <div style={{
          background: "rgba(99,102,241,.12)", border: "2px dashed #6366F1",
          borderRadius: 14, padding: "18px 24px", marginBottom: 24,
          cursor: "pointer", animation: "pulse 2s ease infinite",
        }} onClick={copyCode}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6366F1", letterSpacing: 2, marginBottom: 6 }}>YOUR DISCOUNT CODE</div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 6, color: "#F9FAFB", fontFamily: "monospace" }}>{DISCOUNT_CODE}</div>
          <div style={{ fontSize: 12, color: copied ? "#10B981" : "#9CA3AF", marginTop: 8 }}>
            {copied ? "✓ Copied!" : "Click to copy"}
          </div>
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", gap: 12, flexDirection: "column" }}>
          <button onClick={copyCode} style={{
            background: "linear-gradient(135deg,#6366F1,#4F46E5)", color: "#fff",
            border: "none", borderRadius: 12, padding: "14px 24px",
            fontWeight: 700, fontSize: 15, cursor: "pointer", width: "100%",
          }}>
            {copied ? "✓ Code Copied — Finish Your Order!" : "Copy Code & Complete Order"}
          </button>
          <button onClick={dismiss} style={{
            background: "none", color: "#6B7280", border: "none", cursor: "pointer",
            fontSize: 13, padding: "6px",
          }}>
            No thanks, I'll pay full price
          </button>
        </div>

        <p style={{ fontSize: 11, color: "#4B5563", marginTop: 16 }}>
          *One-time use. Valid for new orders only. Expires in 24 hours.
        </p>
      </div>
    </div>
  );
}
