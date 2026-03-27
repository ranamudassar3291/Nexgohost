/**
 * SafepayReturn — landing page after Safepay redirects the client back.
 *
 * URL: /client/payment/return?tracker=tok_xxx&invoice=<invoiceId>
 *
 * Shows a real-time animated stepper that:
 * 1. Polls the invoice status every 2 seconds (up to 15s)
 * 2. Animates through activation steps as soon as payment is confirmed
 * 3. Falls back to "pending" state if webhook hasn't arrived yet
 */
import { useEffect, useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle, Loader2, XCircle, Shield, Server, Globe, Mail, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

const ACTIVATION_STEPS = [
  { icon: Shield,  label: "Payment Verified",       detail: "Safepay confirmed your transaction" },
  { icon: Server,  label: "Creating Hosting Account", detail: "Provisioning cPanel / WHM account" },
  { icon: Globe,   label: "Configuring DNS Records",  detail: "Setting up A, MX and CNAME records" },
  { icon: Mail,    label: "Setting Up Email",          detail: "Creating default mailboxes" },
  { icon: Zap,     label: "Service Active",            detail: "Your hosting is ready to use" },
];

export default function SafepayReturn() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const invoiceId = params.get("invoice") ?? "";
  const tracker = params.get("tracker") ?? "";

  const [phase, setPhase] = useState<"polling" | "activating" | "paid" | "pending" | "error">("polling");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Polling: check invoice status ────────────────────────────────────────
  useEffect(() => {
    if (!invoiceId) { setPhase("error"); return; }

    let cancelled = false;
    const MAX_ATTEMPTS = 10;
    let attempt = 0;

    async function poll() {
      try {
        const data = await apiFetch(`/api/my/invoices/${invoiceId}`);
        if (cancelled) return;
        setInvoiceNumber(data.invoiceNumber ?? "");
        if (data.status === "paid") {
          setPhase("activating");
          runActivationAnimation();
          return;
        }
      } catch { /* keep trying on network error */ }

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
    };
  }, [invoiceId]);

  // ─── Animated stepper on paid ─────────────────────────────────────────────
  function runActivationAnimation() {
    const STEP_DELAY = 900; // ms per step
    ACTIVATION_STEPS.forEach((_, idx) => {
      setTimeout(() => {
        setCurrentStep(idx + 1);
        if (idx === ACTIVATION_STEPS.length - 1) {
          setTimeout(() => setPhase("paid"), 600);
        }
      }, idx * STEP_DELAY);
    });
  }

  const goToInvoice = () => setLocation(`/client/invoices/${invoiceId}`);
  const goToDashboard = () => setLocation("/client/dashboard");

  // ─── ACTIVATING: stepper ──────────────────────────────────────────────────
  if (phase === "activating") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4 ring-2 ring-green-500/30 ring-offset-2 ring-offset-background">
              <Shield size={28} className="text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Activating Your Service</h1>
            <p className="text-muted-foreground text-sm mt-1">Payment confirmed — setting everything up for you</p>
          </div>

          <div className="space-y-3">
            {ACTIVATION_STEPS.map((step, idx) => {
              const done = idx < currentStep;
              const active = idx === currentStep - 1 && currentStep <= ACTIVATION_STEPS.length;
              const pending = idx >= currentStep;
              const Icon = step.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: pending ? 0.35 : 1, x: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                    done    ? "border-green-500/30 bg-green-500/5"  :
                    active  ? "border-primary/40 bg-primary/5"      :
                              "border-border/40 bg-card/30"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    done   ? "bg-green-500/20" :
                    active ? "bg-primary/15"   :
                             "bg-muted/40"
                  }`}>
                    {done ? (
                      <CheckCircle size={18} className="text-green-400" />
                    ) : active ? (
                      <Loader2 size={18} className="text-primary animate-spin" />
                    ) : (
                      <Icon size={18} className="text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${done ? "text-green-400" : active ? "text-foreground" : "text-muted-foreground/50"}`}>
                      {step.label}
                    </p>
                    {(done || active) && (
                      <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Please wait — this usually takes less than 30 seconds
          </p>
        </div>
      </div>
    );
  }

  // ─── POLLING: initial spinner ─────────────────────────────────────────────
  if (phase === "polling") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto ring-4 ring-primary/10 ring-offset-2 ring-offset-background">
            <Loader2 size={36} className="text-primary animate-spin" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Confirming Payment…</h1>
            <p className="text-muted-foreground text-sm">We're waiting for Safepay to confirm your transaction.</p>
          </div>
          <div className="flex justify-center gap-1.5">
            {[0,1,2].map(i => (
              <motion.div key={i} className="w-2 h-2 rounded-full bg-primary/50"
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.3 }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── PAID: full success ───────────────────────────────────────────────────
  if (phase === "paid") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto ring-4 ring-green-500/20 ring-offset-4 ring-offset-background">
            <CheckCircle size={48} className="text-green-400" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Hosting Activated!</h1>
            {invoiceNumber && <p className="text-muted-foreground text-sm mb-1">Invoice #{invoiceNumber}</p>}
            <p className="text-muted-foreground">
              Your hosting account is live. DNS records are configured and your cPanel is ready to access.
              A confirmation email has been sent to you.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 py-2">
            {[
              { icon: Server, label: "Hosting", sub: "Active" },
              { icon: Globe,  label: "DNS",     sub: "Configured" },
              { icon: Mail,   label: "Email",   sub: "Ready" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="p-3 rounded-xl bg-green-500/5 border border-green-500/20 text-center">
                <Icon size={20} className="text-green-400 mx-auto mb-1" />
                <p className="text-xs font-semibold text-foreground">{label}</p>
                <p className="text-[10px] text-green-400">{sub}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button onClick={goToDashboard} variant="outline" className="flex-1">Dashboard</Button>
            <Button onClick={goToInvoice} className="flex-1 bg-primary hover:bg-primary/90">View Invoice</Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ─── PENDING: webhook hasn't arrived yet ──────────────────────────────────
  if (phase === "pending") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto">
            <CheckCircle size={40} className="text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Payment Submitted</h1>
            <p className="text-muted-foreground">
              Your payment was sent to Safepay. Confirmation is on its way — your hosting will activate automatically within a few minutes once the webhook arrives.
            </p>
            {tracker && (
              <p className="text-xs text-muted-foreground font-mono mt-3 break-all bg-muted/30 p-2 rounded-lg">
                Ref: {tracker}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button onClick={goToDashboard} variant="outline" className="flex-1">Dashboard</Button>
            <Button onClick={goToInvoice} className="flex-1 bg-primary hover:bg-primary/90">View Invoice</Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ERROR ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
          <XCircle size={40} className="text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Something Went Wrong</h1>
          <p className="text-muted-foreground">We couldn't retrieve your payment status. Please check your invoices page.</p>
        </div>
        <Button onClick={() => setLocation("/client/invoices")} className="bg-primary hover:bg-primary/90">
          Go to Invoices
        </Button>
      </div>
    </div>
  );
}
