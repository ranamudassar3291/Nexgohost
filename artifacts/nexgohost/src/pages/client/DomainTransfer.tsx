import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Key, Package, Lock, Unlock, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/context/CurrencyProvider";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";

type Step = "enter" | "validate" | "submit" | "success";

export default function DomainTransfer() {
  const { formatPrice } = useCurrency();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("enter");
  const [domain, setDomain] = useState("");
  const [epp, setEpp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [transferResult, setTransferResult] = useState<any>(null);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch("/api/domains/transfer/validate", {
        method: "POST",
        body: JSON.stringify({ domainName: domain, epp }),
      });
      setValidationResult(result);
      if (result.valid) {
        setStep("validate");
      } else {
        setError(result.error || result.message || "Validation failed");
      }
    } catch (err: any) {
      setError(err.message || "Validation failed. Please check your domain and EPP code.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch("/api/domains/transfer", {
        method: "POST",
        body: JSON.stringify({ domainName: domain, epp }),
      });
      setTransferResult(result);
      setStep("success");
    } catch (err: any) {
      setError(err.message || "Failed to submit transfer. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: "enter", label: "Domain & EPP" },
    { id: "validate", label: "Validation" },
    { id: "submit", label: "Confirm" },
    { id: "success", label: "Submitted" },
  ];

  const stepIndex = steps.findIndex(s => s.id === step);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Domain Transfer</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Transfer your existing domain to Nexgohost</p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${i <= stepIndex ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}>
              {i < stepIndex ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i <= stepIndex ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`h-px flex-1 ${i < stepIndex ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <AnimatePresence mode="wait">

          {/* Step 1: Enter domain & EPP */}
          {step === "enter" && (
            <motion.div key="enter" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Globe size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Enter Domain Details</h2>
                  <p className="text-xs text-muted-foreground">Get your EPP/Auth code from your current registrar</p>
                </div>
              </div>

              <form onSubmit={handleValidate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Domain Name</label>
                  <Input
                    value={domain}
                    onChange={e => { setDomain(e.target.value.trim().toLowerCase()); setError(null); }}
                    placeholder="example.com"
                    className="bg-background/60 border-border h-11"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">EPP / Authorization Code</label>
                  <div className="relative">
                    <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={epp}
                      onChange={e => { setEpp(e.target.value); setError(null); }}
                      placeholder="Min. 8 chars, letters and numbers"
                      className="bg-background/60 border-border h-11 pl-9"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Must be at least 8 characters with both letters and numbers</p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
                  </div>
                )}

                <div className="bg-secondary/50 rounded-xl p-4 text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground/70 text-xs uppercase tracking-wider mb-2">Before transferring, ensure:</p>
                  <p>• Domain is unlocked at your current registrar</p>
                  <p>• Domain is not within 60 days of registration or renewal</p>
                  <p>• You have the EPP/Auth code ready (min. 8 characters)</p>
                  <p>• WHOIS privacy is temporarily disabled</p>
                </div>

                <Button type="submit" disabled={loading} className="w-full h-11 gap-2">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Validate Domain</span> <ArrowRight size={16} /></>}
                </Button>
              </form>
            </motion.div>
          )}

          {/* Step 2: Validation result */}
          {step === "validate" && validationResult && (
            <motion.div key="validate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-green-400" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Domain Validated</h2>
                <p className="text-sm text-green-400">Domain is eligible for transfer. EPP code validated.</p>
              </div>

              <div className="bg-secondary/50 rounded-xl p-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Domain</span>
                  <span className="font-medium text-foreground">{validationResult.domain}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">TLD</span>
                  <span className="font-medium text-foreground">.{validationResult.tld}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Domain Status</span>
                  <span className="font-medium text-green-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Registered
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Lock Status</span>
                  {validationResult.lockStatus === "unlocked" ? (
                    <span className="font-medium text-green-400 flex items-center gap-1.5">
                      <Unlock size={13} /> Unlocked
                    </span>
                  ) : (
                    <span className="font-medium text-red-400 flex items-center gap-1.5">
                      <Lock size={13} /> Locked
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2.5">
                  <span className="text-muted-foreground">Transfer Fee</span>
                  <span className="font-bold text-foreground">{formatPrice(Number(validationResult.transferPrice || 0))}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setStep("enter"); setError(null); }} className="flex-1 gap-2">
                  <ArrowLeft size={16} /> Back
                </Button>
                <Button onClick={() => setStep("submit")} className="flex-1 gap-2">
                  Continue <ArrowRight size={16} />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Confirm */}
          {step === "submit" && (
            <motion.div key="submit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <ShieldCheck size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Confirm Transfer Request</h2>
                  <p className="text-xs text-muted-foreground">Review your transfer details before submitting</p>
                </div>
              </div>

              <div className="bg-secondary/50 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Domain</span>
                  <span className="font-medium text-foreground">{domain}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">EPP Code</span>
                  <span className="font-medium text-foreground font-mono">{"•".repeat(Math.min(epp.length, 8))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Lock Status</span>
                  <span className="font-medium text-green-400 flex items-center gap-1.5">
                    <Unlock size={13} /> Unlocked
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-muted-foreground">Transfer Fee</span>
                  <span className="font-bold text-foreground text-base">
                    {formatPrice(Number(validationResult?.transferPrice || 0))}
                  </span>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-400 space-y-1">
                <p className="font-medium">What happens next?</p>
                <p>• An invoice will be created for the transfer fee</p>
                <p>• Your domain will appear in your dashboard as "Pending Transfer"</p>
                <p>• Our team will review and process within 24–48 hours</p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("validate")} className="flex-1 gap-2">
                  <ArrowLeft size={16} /> Back
                </Button>
                <Button onClick={handleSubmit} disabled={loading} className="flex-1 gap-2">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Submit Transfer</span> <ArrowRight size={16} /></>}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Success */}
          {step === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center space-y-5 py-4">
              <div className="w-20 h-20 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} className="text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-foreground">Transfer Submitted!</h2>
                <p className="text-muted-foreground text-sm mt-2">
                  Your transfer request for <span className="text-foreground font-medium">{domain}</span> has been submitted successfully.
                </p>
              </div>

              {/* Invoice & Order info */}
              {transferResult && (
                <div className="bg-secondary/50 rounded-xl p-4 space-y-2.5 text-sm text-left">
                  {transferResult.invoice && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Receipt size={13} /> Invoice</span>
                      <span className="font-medium text-foreground">#{transferResult.invoice.invoiceNumber}</span>
                    </div>
                  )}
                  {transferResult.invoice && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Amount Due</span>
                      <span className="font-bold text-foreground">{formatPrice(Number(transferResult.invoice.amount || 0))}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Domain Status</span>
                    <span className="font-medium text-yellow-400">Pending Transfer</span>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Our team will review and process your transfer within 24–48 hours. You'll receive an email confirmation.
              </p>

              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => { setStep("enter"); setDomain(""); setEpp(""); setError(null); setValidationResult(null); setTransferResult(null); }}>
                  Transfer Another
                </Button>
                {transferResult?.invoice && (
                  <Button variant="outline" onClick={() => setLocation(`/client/invoices`)} className="gap-2">
                    <FileText size={16} /> Pay Invoice
                  </Button>
                )}
                <Button onClick={() => setLocation("/client/domains")} className="gap-2">
                  <Package size={16} /> View Domains
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}
