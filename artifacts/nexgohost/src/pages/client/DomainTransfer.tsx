import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2, ShieldCheck,
  Key, Package, Lock, Unlock, FileText, Receipt, AlertTriangle, Info,
  Tag, Smartphone, Landmark, CreditCard, Wallet, Bitcoin, CheckCircle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/context/CurrencyProvider";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";

type Step = "enter" | "validate" | "submit" | "success";

interface PaymentMethod {
  id: string; name: string; type: string; description: string | null;
  publicSettings: {
    bankName?: string; accountTitle?: string; accountNumber?: string;
    mobileNumber?: string; paypalEmail?: string; walletAddress?: string;
    cryptoType?: string; instructions?: string; iban?: string;
  };
}

function PayIcon({ type }: { type: string }) {
  switch (type) {
    case "jazzcash":      return <Smartphone size={18} className="text-orange-400" />;
    case "easypaisa":    return <Smartphone size={18} className="text-green-400" />;
    case "bank_transfer":return <Landmark   size={18} className="text-blue-400" />;
    case "stripe":       return <CreditCard size={18} className="text-violet-400" />;
    case "paypal":       return <Wallet     size={18} className="text-blue-500" />;
    case "crypto":       return <Bitcoin    size={18} className="text-orange-500" />;
    default:             return <CreditCard size={18} className="text-muted-foreground" />;
  }
}

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

  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount: number; finalPrice: number } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Payment method state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [pmLoading, setPmLoading] = useState(false);

  // Fetch payment methods
  useEffect(() => {
    setPmLoading(true);
    apiFetch("/api/payment-methods")
      .then((data: PaymentMethod[]) => {
        setPaymentMethods(data || []);
        if (data?.length > 0) setSelectedPaymentMethod(data[0].id);
      })
      .catch(() => {})
      .finally(() => setPmLoading(false));
  }, []);

  const basePrice = Number(validationResult?.transferPrice || 0);
  const finalPrice = promoApplied ? promoApplied.finalPrice : basePrice;

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoError(null);
    setPromoLoading(true);
    try {
      const params = new URLSearchParams({
        code: promoCode.trim().toUpperCase(),
        amount: String(basePrice),
        serviceType: "domain",
      });
      const result = await apiFetch(`/api/promo-codes/validate?${params}`);
      if (result.valid) {
        const discountedPrice = Math.max(0, basePrice - result.discountAmount);
        setPromoApplied({ code: promoCode.trim().toUpperCase(), discount: result.discountAmount, finalPrice: discountedPrice });
      } else {
        setPromoError(result.message || "Invalid or expired promo code");
      }
    } catch (err: any) {
      setPromoError(err.message || "Failed to validate promo code");
    } finally {
      setPromoLoading(false);
    }
  };

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
        body: JSON.stringify({
          domainName: domain,
          epp,
          promoCode: promoApplied?.code || undefined,
          paymentMethodId: selectedPaymentMethod || undefined,
        }),
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
    { id: "enter",   label: "Domain & EPP" },
    { id: "validate", label: "Validation" },
    { id: "submit",  label: "Confirm & Pay" },
    { id: "success", label: "Submitted" },
  ];
  const stepIndex = steps.findIndex(s => s.id === step);

  const lockStatus: "locked" | "unlocked" | "unknown" = validationResult?.lockStatus ?? "unknown";
  const selectedPm = paymentMethods.find(pm => pm.id === selectedPaymentMethod);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Domain Transfer</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Transfer your existing domain to Noehost</p>
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
                  <p className="text-xs text-muted-foreground">Enter the full domain name including extension (e.g. example.com)</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">EPP / Authorization Code</label>
                  <div className="relative">
                    <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={epp}
                      onChange={e => { setEpp(e.target.value); setError(null); }}
                      placeholder="Min. 8 chars, both letters and numbers"
                      className="bg-background/60 border-border h-11 pl-9"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Get this from your current registrar's control panel. Must be 8+ characters with letters and numbers.</p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
                  </div>
                )}

                <div className="bg-secondary/50 rounded-xl p-4 text-sm text-muted-foreground space-y-1.5">
                  <p className="font-medium text-foreground/70 text-xs uppercase tracking-wider mb-2">Before transferring, ensure:</p>
                  <p className="flex items-center gap-2"><Unlock size={13} /> Domain is <strong>unlocked</strong> at your current registrar</p>
                  <p className="flex items-center gap-2"><Info size={13} /> Domain was registered more than 60 days ago</p>
                  <p className="flex items-center gap-2"><Key size={13} /> You have the EPP/Auth code ready (8+ chars)</p>
                  <p className="flex items-center gap-2"><Globe size={13} /> WHOIS privacy is temporarily disabled</p>
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
                <p className="text-sm text-green-400">Domain is eligible for transfer. EPP code accepted.</p>
              </div>

              <div className="bg-secondary/50 rounded-xl p-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Domain</span>
                  <span className="font-medium text-foreground font-mono">{validationResult.domain}</span>
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
                  <span className="text-muted-foreground">Transfer Lock</span>
                  {lockStatus === "unlocked" ? (
                    <span className="font-medium text-green-400 flex items-center gap-1.5">
                      <Unlock size={13} /> Unlocked — Ready to Transfer
                    </span>
                  ) : lockStatus === "unknown" ? (
                    <span className="font-medium text-yellow-400 flex items-center gap-1.5">
                      <AlertTriangle size={13} /> Unknown — Verify with registrar
                    </span>
                  ) : (
                    <span className="font-medium text-red-400 flex items-center gap-1.5">
                      <Lock size={13} /> Locked
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2.5">
                  <span className="text-muted-foreground">Transfer Fee</span>
                  <span className="font-bold text-foreground text-base">{formatPrice(Number(validationResult.transferPrice || 0))}</span>
                </div>
              </div>

              {lockStatus === "unknown" && (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm text-yellow-400">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Transfer lock status could not be confirmed automatically.</p>
                    <p className="text-xs mt-0.5">Please log in to your current registrar and confirm the transfer lock (ClientTransferProhibited) is <strong>disabled</strong> before proceeding.</p>
                  </div>
                </div>
              )}

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

          {/* Step 3: Confirm & Pay */}
          {step === "submit" && (
            <motion.div key="submit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <ShieldCheck size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Confirm & Select Payment</h2>
                  <p className="text-xs text-muted-foreground">Review details, apply promo, and select payment method</p>
                </div>
              </div>

              {/* Order summary */}
              <div className="bg-secondary/50 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Domain</span>
                  <span className="font-medium text-foreground font-mono">{domain}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">EPP Code</span>
                  <span className="font-medium text-foreground font-mono">{"•".repeat(Math.min(epp.length, 8))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Transfer Lock</span>
                  {lockStatus === "unlocked" ? (
                    <span className="font-medium text-green-400 flex items-center gap-1.5">
                      <Unlock size={13} /> Unlocked
                    </span>
                  ) : (
                    <span className="font-medium text-yellow-400 flex items-center gap-1.5">
                      <AlertTriangle size={13} /> Unknown — ensure unlocked
                    </span>
                  )}
                </div>
                <div className="border-t border-border pt-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Transfer Fee</span>
                    <span className={`font-medium ${promoApplied ? "line-through text-muted-foreground text-xs" : "font-bold text-foreground text-base"}`}>
                      {formatPrice(basePrice)}
                    </span>
                  </div>
                  {promoApplied && (
                    <div className="flex items-center justify-between">
                      <span className="text-green-400 flex items-center gap-1"><Tag size={12} /> Promo ({promoApplied.code})</span>
                      <span className="text-green-400 font-medium">- {formatPrice(promoApplied.discount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border/50 pt-1.5">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="font-bold text-foreground text-base">{formatPrice(finalPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Promo code */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5"><Tag size={14} /> Promo Code</label>
                {promoApplied ? (
                  <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <span className="text-sm text-green-400 font-medium flex items-center gap-2">
                      <CheckCircle size={14} /> {promoApplied.code} — {formatPrice(promoApplied.discount)} off
                    </span>
                    <button onClick={() => { setPromoApplied(null); setPromoCode(""); setPromoError(null); }} className="text-muted-foreground hover:text-foreground">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={promoCode}
                      onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(null); }}
                      placeholder="Enter promo code"
                      className="bg-background/60 border-border h-10 flex-1 uppercase"
                    />
                    <Button variant="outline" onClick={handleApplyPromo} disabled={promoLoading || !promoCode.trim()} className="h-10 gap-1.5 shrink-0">
                      {promoLoading ? <Loader2 size={13} className="animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                )}
                {promoError && (
                  <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} /> {promoError}</p>
                )}
              </div>

              {/* Payment method selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5"><CreditCard size={14} /> Payment Method</label>
                {pmLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
                    <Loader2 size={14} className="animate-spin" /> Loading payment methods...
                  </div>
                ) : paymentMethods.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payment methods configured.</p>
                ) : (
                  <div className="space-y-2">
                    {paymentMethods.map(pm => (
                      <button
                        key={pm.id}
                        onClick={() => setSelectedPaymentMethod(pm.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          selectedPaymentMethod === pm.id
                            ? "border-primary/50 bg-primary/5"
                            : "border-border bg-secondary/30 hover:border-border/80"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <PayIcon type={pm.type} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{pm.name}</p>
                            {pm.description && <p className="text-xs text-muted-foreground truncate">{pm.description}</p>}
                          </div>
                          {selectedPaymentMethod === pm.id && (
                            <CheckCircle size={16} className="text-primary shrink-0" />
                          )}
                        </div>
                        {selectedPaymentMethod === pm.id && pm.publicSettings && (
                          <div className="mt-2.5 pt-2.5 border-t border-border/50 space-y-1 text-xs text-muted-foreground">
                            {pm.publicSettings.bankName && <p>Bank: <span className="text-foreground font-medium">{pm.publicSettings.bankName}</span></p>}
                            {pm.publicSettings.accountTitle && <p>Account: <span className="text-foreground font-medium">{pm.publicSettings.accountTitle}</span></p>}
                            {pm.publicSettings.accountNumber && <p>Number: <span className="text-foreground font-mono font-medium">{pm.publicSettings.accountNumber}</span></p>}
                            {pm.publicSettings.mobileNumber && <p>Mobile: <span className="text-foreground font-mono font-medium">{pm.publicSettings.mobileNumber}</span></p>}
                            {pm.publicSettings.iban && <p>IBAN: <span className="text-foreground font-mono font-medium">{pm.publicSettings.iban}</span></p>}
                            {pm.publicSettings.walletAddress && <p>Wallet: <span className="text-foreground font-mono font-medium break-all">{pm.publicSettings.walletAddress}</span></p>}
                            {pm.publicSettings.instructions && <p className="text-blue-400">{pm.publicSettings.instructions}</p>}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-400 space-y-1.5">
                <p className="font-medium">What happens next?</p>
                <p>• An invoice will be created for the transfer fee</p>
                <p>• Your domain will appear in your dashboard as "Pending Transfer"</p>
                <p>• Our team will review your request within 24–48 hours</p>
                <p>• Once approved, your current registrar will send an authorization email — approve it promptly</p>
                <p>• Transfer completes within 5–7 business days after authorization</p>
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
                <Button onClick={handleSubmit} disabled={loading || !selectedPaymentMethod} className="flex-1 gap-2">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Submit Transfer Request</span> <ArrowRight size={16} /></>}
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
                  Your transfer request for <span className="text-foreground font-medium font-mono">{domain}</span> has been submitted successfully.
                </p>
              </div>

              {transferResult && (
                <div className="bg-secondary/50 rounded-xl p-4 space-y-2.5 text-sm text-left">
                  {transferResult.invoice && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Receipt size={13} /> Invoice</span>
                        <span className="font-medium text-foreground">#{transferResult.invoice.invoiceNumber}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Amount Due</span>
                        <span className="font-bold text-foreground">{formatPrice(Number(transferResult.invoice.amount || 0))}</span>
                      </div>
                    </>
                  )}
                  {selectedPm && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Payment Via</span>
                      <span className="font-medium text-foreground flex items-center gap-1.5"><PayIcon type={selectedPm.type} /> {selectedPm.name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium text-yellow-400">Pending Review</span>
                  </div>
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-400 space-y-1 text-left">
                <p className="font-medium">Check your email</p>
                <p>A confirmation email has been sent to your registered email address with full transfer details.</p>
              </div>

              <div className="flex gap-3 justify-center flex-wrap">
                <Button variant="outline" onClick={() => { setStep("enter"); setDomain(""); setEpp(""); setError(null); setValidationResult(null); setTransferResult(null); setPromoApplied(null); setPromoCode(""); setSelectedPaymentMethod(paymentMethods[0]?.id ?? ""); }}>
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
