import { useState, useEffect } from "react";
import { Link } from "wouter";

const STORAGE_KEY = "noehost_cookie_consent";

type ConsentState = "accepted" | "declined" | null;

export default function CookieConsent() {
  const [consent, setConsent] = useState<ConsentState>(null);
  const [visible, setVisible] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [prefs, setPrefs] = useState({ essential: true, analytics: true, marketing: false });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
    setConsent(saved as ConsentState);
  }, []);

  function acceptAll() {
    setPrefs({ essential: true, analytics: true, marketing: true });
    save("accepted");
  }

  function declineAll() {
    setPrefs({ essential: true, analytics: false, marketing: false });
    save("declined");
  }

  function savePrefs() {
    save(prefs.analytics || prefs.marketing ? "accepted" : "declined");
  }

  function save(v: ConsentState) {
    localStorage.setItem(STORAGE_KEY, v as string);
    setConsent(v);
    setVisible(false);
    setShowManage(false);
  }

  if (!visible || consent !== null) return null;

  return (
    <>
      {/* Backdrop for manage panel */}
      {showManage && (
        <div
          className="fixed inset-0 bg-black/50 z-[199] backdrop-blur-sm"
          onClick={() => setShowManage(false)}
        />
      )}

      {/* Manage Preferences Panel */}
      {showManage && (
        <div className="fixed bottom-0 left-0 right-0 z-[200] flex justify-center px-4 pb-4">
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
            style={{ background: "#13131f" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🍪</span>
                <span className="text-white font-semibold text-sm">Cookie Preferences</span>
              </div>
              <button
                onClick={() => setShowManage(false)}
                className="text-gray-400 hover:text-white transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* Toggles */}
            <div className="px-5 py-4 space-y-4">
              {[
                {
                  key: "essential",
                  label: "Essential Cookies",
                  desc: "Required for login sessions and security. Cannot be disabled.",
                  locked: true,
                  value: true,
                },
                {
                  key: "analytics",
                  label: "Analytics Cookies",
                  desc: "Help us understand how visitors interact with our website (anonymized).",
                  locked: false,
                  value: prefs.analytics,
                },
                {
                  key: "marketing",
                  label: "Marketing Cookies",
                  desc: "Used to deliver personalized offers and promotional content.",
                  locked: false,
                  value: prefs.marketing,
                },
              ].map((item) => (
                <div key={item.key} className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{item.label}</p>
                    <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                  <button
                    disabled={item.locked}
                    onClick={() => {
                      if (item.locked) return;
                      setPrefs(p => ({ ...p, [item.key]: !p[item.key as keyof typeof p] }));
                    }}
                    className={`flex-shrink-0 relative w-10 h-5.5 rounded-full transition-all mt-0.5 ${
                      item.value
                        ? "bg-violet-600"
                        : "bg-white/20"
                    } ${item.locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                    style={{ width: 40, height: 22 }}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform"
                      style={{ transform: item.value ? "translateX(18px)" : "translateX(0)" }}
                    />
                    {item.locked && (
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white/60">🔒</span>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Footer buttons */}
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={savePrefs}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white border border-white/20 hover:bg-white/10 transition-colors"
              >
                Save Preferences
              </button>
              <button
                onClick={acceptAll}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Cookie Banner */}
      {!showManage && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[198] px-4 pb-4 pt-2"
          style={{
            animation: "cookieSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          <style>{`
            @keyframes cookieSlideUp {
              from { transform: translateY(100%); opacity: 0; }
              to   { transform: translateY(0);    opacity: 1; }
            }
          `}</style>

          <div
            className="max-w-5xl mx-auto rounded-2xl border border-white/10 shadow-2xl"
            style={{ background: "rgba(13,13,26,0.97)", backdropFilter: "blur(20px)" }}
          >
            <div className="flex flex-col md:flex-row md:items-center gap-4 px-5 py-4">

              {/* Icon + text */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg mt-0.5"
                  style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}
                >
                  🍪
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold mb-0.5">We use cookies</p>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. By clicking{" "}
                    <span className="text-white font-medium">"Accept All"</span>, you consent to our use of cookies.{" "}
                    <Link href="/privacy-policy" className="text-violet-400 underline underline-offset-2 hover:text-violet-300">
                      Privacy Policy
                    </Link>
                    {" · "}
                    <Link href="/terms-and-conditions" className="text-violet-400 underline underline-offset-2 hover:text-violet-300">
                      Terms
                    </Link>
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap md:flex-nowrap">
                <button
                  onClick={() => setShowManage(true)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 border border-white/15 hover:bg-white/8 hover:text-white transition-all whitespace-nowrap"
                  style={{ minWidth: 120 }}
                >
                  Manage Settings
                </button>
                <button
                  onClick={declineAll}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 border border-white/15 hover:bg-white/8 hover:text-white transition-all whitespace-nowrap"
                >
                  Decline
                </button>
                <button
                  onClick={acceptAll}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-all hover:opacity-90 whitespace-nowrap"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", minWidth: 100 }}
                >
                  Accept All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
