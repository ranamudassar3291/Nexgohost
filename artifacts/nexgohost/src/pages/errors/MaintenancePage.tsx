interface Props {
  onRetry?: () => void;
}

export default function MaintenancePage({ onRetry }: Props) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #0f0c29 0%, #1a1060 50%, #24243e 100%)" }}
    >
      <div className="text-center max-w-md w-full">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8"
          style={{
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(107,70,193,0.3)",
            boxShadow: "0 0 40px rgba(99,102,241,0.15)",
          }}
        >
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </div>

        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5"
          style={{ background: "rgba(251,191,36,0.12)", color: "#FCD34D", border: "1px solid rgba(251,191,36,0.2)" }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#FCD34D" }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#FCD34D" }} />
          </span>
          Scheduled Maintenance
        </div>

        <h1 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          We'll be right back
        </h1>
        <p className="text-base mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
          Our team is performing scheduled maintenance to improve your experience.
        </p>
        <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.35)" }}>
          Services will resume shortly. Thank you for your patience.
        </p>

        <div
          className="rounded-2xl p-5 mb-8 text-left"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
            System Status
          </p>
          <div className="space-y-2.5">
            {[
              { name: "API Services", status: "degraded" },
              { name: "Control Panel", status: "degraded" },
              { name: "Billing & Invoicing", status: "operational" },
              { name: "Email Delivery", status: "operational" },
            ].map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{item.name}</span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={item.status === "operational"
                    ? { background: "rgba(16,185,129,0.12)", color: "#34D399" }
                    : { background: "rgba(251,191,36,0.12)", color: "#FCD34D" }
                  }
                >
                  {item.status === "operational" ? "Operational" : "Degraded"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onRetry ?? (() => window.location.reload())}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #6B46C1 0%, #7C5DE2 100%)", boxShadow: "0 4px 20px rgba(107,70,193,0.3)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Check Again
          </button>
          <a
            href="mailto:support@nexgohost.com"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            Contact Support
          </a>
        </div>

        <p className="mt-10 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
          © {new Date().getFullYear()} Nexgohost. All rights reserved.
        </p>
      </div>
    </div>
  );
}
