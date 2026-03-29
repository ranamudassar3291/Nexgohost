import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Server, Rocket, LayoutDashboard, ChevronRight, ChevronLeft,
  X, Sparkles, ShieldCheck, Ticket,
} from "lucide-react";

const TOUR_KEY = "noehost_tour_v1";

const STEPS = [
  {
    icon: Sparkles,
    color: "#4F46E5",
    title: "Welcome to Noehost! 🎉",
    subtitle: "Your all-in-one hosting platform",
    body: "We're glad to have you. This quick tour will show you around the key areas of your control panel — it takes less than a minute.",
    action: null,
  },
  {
    icon: Globe,
    color: "#2563eb",
    title: "Your Domain Hub",
    subtitle: "My Domains in the sidebar",
    body: "Head to My Domains to register new domains, manage DNS records, set nameservers, and configure auto-renewal — all from one place.",
    highlight: "Domains",
    action: null,
  },
  {
    icon: Server,
    color: "#6366F1",
    title: "Manage Your Hosting",
    subtitle: "My Services in the sidebar",
    body: "My Services shows all your active hosting plans. From there you can open cPanel, check resource usage (disk, bandwidth), install WordPress, and manage SSL.",
    highlight: "My Services",
    action: null,
  },
  {
    icon: ShieldCheck,
    color: "#10b981",
    title: "Billing & Invoices",
    subtitle: "Invoices in the sidebar",
    body: "View all invoices, track payment transactions, and request refunds — all with live currency conversion based on your region.",
    highlight: "Invoices",
    action: null,
  },
  {
    icon: Rocket,
    color: "#f59e0b",
    title: "Ready to Launch Your Site?",
    subtitle: "You're all set!",
    body: "Start by registering a domain, then add a hosting plan. Your site can be live in minutes. Click the button below to order your first service.",
    action: { label: "Order Hosting →", href: "/client/orders/new" },
  },
];

export function WelcomeTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  function dismiss() {
    localStorage.setItem(TOUR_KEY, "1");
    onClose();
  }

  function next() {
    if (isLast) { dismiss(); return; }
    setStep(s => s + 1);
  }

  function back() {
    setStep(s => Math.max(0, s - 1));
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
          style={{ background: "linear-gradient(145deg, #1a1033 0%, #120e25 60%, #0d0b1a 100%)" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Top gradient accent */}
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${current.color}cc, ${current.color}44)` }} />

          {/* Close button */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
          >
            <X size={15} />
          </button>

          <div className="px-7 pt-7 pb-6 space-y-5">
            {/* Icon */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                style={{ background: `linear-gradient(135deg, ${current.color}30 0%, ${current.color}15 100%)`, border: `1px solid ${current.color}40` }}>
                <Icon size={24} style={{ color: current.color }} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: current.color }}>
                  {current.subtitle}
                </p>
                <h2 className="text-xl font-bold text-white leading-tight">{current.title}</h2>
              </div>
            </div>

            {/* Body */}
            <p className="text-sm text-white/65 leading-relaxed">{current.body}</p>

            {/* Action button (last step) */}
            {current.action && (
              <a
                href={current.action.href}
                onClick={dismiss}
                className="flex items-center justify-center gap-2 h-11 w-full rounded-xl text-sm font-bold text-white shadow-lg"
                style={{ background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 60%, #818CF8 100%)" }}
              >
                <Rocket size={14} /> {current.action.label}
              </a>
            )}

            {/* Navigation row */}
            <div className="flex items-center justify-between pt-1">
              {/* Step dots */}
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className="rounded-full transition-all"
                    style={{
                      width: i === step ? 20 : 6,
                      height: 6,
                      background: i === step ? current.color : "rgba(255,255,255,0.2)",
                    }}
                  />
                ))}
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={dismiss}
                  className="text-xs text-white/35 hover:text-white/60 transition-colors px-1"
                >
                  Skip
                </button>
                {!isFirst && (
                  <button
                    onClick={back}
                    className="flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-medium text-white/60 hover:text-white border border-white/10 hover:border-white/25 transition-colors"
                  >
                    <ChevronLeft size={13} /> Back
                  </button>
                )}
                <button
                  onClick={next}
                  className="flex items-center gap-1 h-8 px-4 rounded-lg text-xs font-bold text-white shadow transition-opacity hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${current.color} 0%, ${current.color}cc 100%)` }}
                >
                  {isLast ? "Done ✓" : "Next"} {!isLast && <ChevronRight size={13} />}
                </button>
              </div>
            </div>
          </div>

          {/* Step counter */}
          <div className="px-7 pb-4 text-right">
            <span className="text-[10px] text-white/20">{step + 1} of {STEPS.length}</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function useWelcomeTour() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(TOUR_KEY);
    const token = localStorage.getItem("token");
    if (!seen && token) {
      // Small delay so the dashboard renders first
      const t = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  return { show, dismiss: () => { localStorage.setItem(TOUR_KEY, "1"); setShow(false); } };
}
