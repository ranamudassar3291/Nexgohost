/**
 * RapidGatewayReturn — client lands here after RapidGateway redirect.
 * URL patterns:
 *   /client/payment/rg-return?invoice=<id>&status=success&ref=<txnId>
 *   /client/payment/rg-return?invoice=<id>&status=failed
 *   /client/payment/rg-return?status=error&error=<msg>
 *
 * Polls invoice status every 2s (up to 15 attempts) and shows animated
 * activation steps once paid — identical UX to SafepayReturn.
 */
import { useEffect, useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle, Loader2, XCircle, Shield, Server, Globe, Mail, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

const ACTIVATION_STEPS = [
  { icon: Shield, label: "Payment Verified",        detail: "RapidGateway confirmed your transaction" },
  { icon: Server, label: "Creating Hosting Account", detail: "Provisioning your hosting account" },
  { icon: Globe,  label: "Configuring DNS Records",  detail: "Setting up A, MX and CNAME records" },
  { icon: Mail,   label: "Setting Up Email",          detail: "Creating default mailboxes" },
  { icon: Zap,    label: "Service Active",             detail: "Your hosting is ready to use" },
];

export default function RapidGatewayReturn() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);

  const invoiceId = params.get("invoice") ?? "";
  const statusParam = params.get("status") ?? "";
  const errorMsg   = params.get("error") ?? "";
  const txnRef     = params.get("ref") ?? "";

  const [phase, setPhase] = useState<"polling" | "activating" | "paid" | "pending" | "failed" | "error">(
    statusParam === "failed" ? "failed" :
    statusParam === "error"  ? "error"  :
    "polling"
  );
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function runActivationAnimation() {
    let step = 0;
    const advance = () => {
      setCurrentStep(step);
      if (step < ACTIVATION_STEPS.length - 1) {
        step++;
        stepTimerRef.current = setTimeout(advance, 900);
      } else {
        setTimeout(() => setPhase("paid"), 800);
      }
    };
    setPhase("activating");
    advance();
  }

  useEffect(() => {
    if (phase === "failed" || phase === "error") return;
    if (!invoiceId) { setPhase("error"); return; }

    let cancelled = false;
    const MAX_ATTEMPTS = 12;
    let attempt = 0;

    async function poll() {
      if (cancelled) return;
      try {
        const data = await apiFetch(`/api/my/invoices/${invoiceId}`);
        if (cancelled) return;
        setInvoiceNumber(data.invoiceNumber ?? "");
        if (data.status === "paid") {
          runActivationAnimation();
          return;
        }
      } catch { /* keep trying */ }

      attempt++;
      if (attempt >= MAX_ATTEMPTS) {
        if (!cancelled) setPhase("pending");
        return;
      }
      pollingRef.current = setTimeout(poll, 2000);
    }

    poll();
    return () => {
      cancelled = true;
      if (pollingRef.current) clearTimeout(pollingRef.current);
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, [invoiceId]);

  // ── POLLING / ACTIVATING ────────────────────────────────────────────────────
  if (phase === "polling" || phase === "activating") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
        >
          <div className="w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {phase === "polling" ? "Verifying Payment…" : "Activating Your Service"}
          </h2>
          <p className="text-slate-400 text-sm mb-8">
            {phase === "polling"
              ? "Confirming your payment with RapidGateway. Please wait…"
              : "Setting up your account. This takes just a moment."}
          </p>

          {/* Activation steps */}
          <div className="space-y-3 text-left">
            {ACTIVATION_STEPS.map((step, i) => {
              const Icon = step.icon;
              const done    = phase === "activating" && i < currentStep;
              const active  = phase === "activating" && i === currentStep;
              const waiting = phase === "polling"   || i > currentStep;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: waiting ? 0.35 : 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    done   ? "border-emerald-500/30 bg-emerald-500/10" :
                    active ? "border-indigo-400/40 bg-indigo-500/10"  :
                             "border-white/5 bg-white/3"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    done   ? "bg-emerald-500/20" :
                    active ? "bg-indigo-500/20"  :
                             "bg-white/5"
                  }`}>
                    {done ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : active ? (
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${done ? "text-emerald-300" : active ? "text-white" : "text-slate-500"}`}>
                      {step.label}
                    </p>
                    {active && (
                      <p className="text-xs text-slate-400 mt-0.5">{step.detail}</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── SUCCESS ─────────────────────────────────────────────────────────────────
  if (phase === "paid") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/5 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </motion.div>

          <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
          <p className="text-emerald-300/80 text-sm mb-1">Your service has been activated</p>
          {invoiceNumber && (
            <p className="text-slate-500 text-xs mb-1">Invoice #{invoiceNumber}</p>
          )}
          {txnRef && (
            <p className="text-slate-600 text-xs mb-6">TXN: {txnRef}</p>
          )}

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-6 text-left">
            <p className="text-emerald-300 text-sm font-medium mb-1">✓ Payment verified by RapidGateway</p>
            <p className="text-emerald-300 text-sm font-medium mb-1">✓ Hosting account created</p>
            <p className="text-emerald-300 text-sm font-medium">✓ Confirmation email sent</p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 rounded-xl"
              onClick={() => setLocation("/dashboard/hosting")}
            >
              Go to My Hosting
            </Button>
            <Button
              variant="ghost"
              className="w-full text-slate-400 hover:text-white"
              onClick={() => setLocation(invoiceId ? `/dashboard/billing/${invoiceId}` : "/dashboard/billing")}
            >
              View Invoice
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── PENDING (webhook hasn't arrived yet) ────────────────────────────────────
  if (phase === "pending") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-xl border border-amber-500/20 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl"
        >
          <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Payment Processing</h2>
          <p className="text-slate-400 text-sm mb-6">
            Your payment was sent to RapidGateway. Your service will activate automatically within a few minutes.
          </p>
          {invoiceNumber && (
            <p className="text-slate-500 text-xs mb-6">Invoice #{invoiceNumber}</p>
          )}
          <div className="flex flex-col gap-3">
            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl"
              onClick={() => setLocation(invoiceId ? `/dashboard/billing/${invoiceId}` : "/dashboard/billing")}
            >
              View Invoice Status
            </Button>
            <Button
              variant="ghost"
              className="w-full text-slate-400 hover:text-white"
              onClick={() => setLocation("/dashboard")}
            >
              Go to Dashboard
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── FAILED / ERROR ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 backdrop-blur-xl border border-red-500/20 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl"
      >
        <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-400/30 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {phase === "failed" ? "Payment Cancelled" : "Something Went Wrong"}
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          {phase === "failed"
            ? "Your payment was not completed. No amount has been charged. Please try again."
            : (errorMsg || "An unexpected error occurred. Please try again or contact support.")}
        </p>
        <div className="flex flex-col gap-3">
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl"
            onClick={() => setLocation(invoiceId ? `/dashboard/billing/${invoiceId}` : "/dashboard/billing")}
          >
            Try Again
          </Button>
          <Button
            variant="ghost"
            className="w-full text-slate-400 hover:text-white"
            onClick={() => setLocation("/dashboard")}
          >
            Back to Dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
