/**
 * SafepayReturn — landing page after Safepay redirects the client back.
 *
 * URL: /client/payment/return?tracker=tok_xxx&invoice=<invoiceId>
 *
 * At this point the payment may or may not have been confirmed via webhook yet.
 * We poll the invoice status for up to 15 seconds, then redirect to the invoice page.
 */
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export default function SafepayReturn() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const invoiceId = params.get("invoice") ?? "";
  const tracker = params.get("tracker") ?? "";

  const [status, setStatus] = useState<"polling" | "paid" | "pending" | "error">("polling");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!invoiceId) { setStatus("error"); return; }

    let cancelled = false;
    const MAX_ATTEMPTS = 10;
    const INTERVAL_MS = 2000;

    async function poll() {
      try {
        const data = await apiFetch(`/api/my/invoices/${invoiceId}`);
        if (cancelled) return;
        setInvoiceNumber(data.invoiceNumber ?? "");
        if (data.status === "paid") {
          setStatus("paid");
          return;
        }
      } catch { /* network error — keep trying */ }

      setAttempts(prev => {
        const next = prev + 1;
        if (next >= MAX_ATTEMPTS) {
          setStatus("pending");
        } else {
          setTimeout(poll, INTERVAL_MS);
        }
        return next;
      });
    }

    poll();
    return () => { cancelled = true; };
  }, [invoiceId]);

  const goToInvoice = () => setLocation(`/client/invoices/${invoiceId}`);
  const goToDashboard = () => setLocation("/client/dashboard");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">

        {/* Polling */}
        {status === "polling" && (
          <>
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Loader2 size={40} className="text-primary animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Confirming Payment…</h1>
              <p className="text-muted-foreground">
                We're verifying your Safepay payment. This usually takes a few seconds.
              </p>
            </div>
          </>
        )}

        {/* Paid */}
        {status === "paid" && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle size={40} className="text-green-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Payment Successful!</h1>
              {invoiceNumber && (
                <p className="text-muted-foreground mb-1">Invoice #{invoiceNumber}</p>
              )}
              <p className="text-muted-foreground">
                Your payment was confirmed and your service is now being activated.
                You'll receive a confirmation email shortly.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={goToDashboard} variant="outline" className="flex-1">Dashboard</Button>
              <Button onClick={goToInvoice} className="flex-1 bg-primary hover:bg-primary/90">View Invoice</Button>
            </div>
          </>
        )}

        {/* Pending — webhook not arrived yet after polling window */}
        {status === "pending" && (
          <>
            <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto">
              <CheckCircle size={40} className="text-yellow-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Payment Submitted</h1>
              <p className="text-muted-foreground">
                Your payment was submitted to Safepay. It may take a moment for confirmation to arrive.
                Your service will activate automatically once the payment is confirmed.
              </p>
              {tracker && (
                <p className="text-xs text-muted-foreground mt-2 font-mono break-all">
                  Tracker: {tracker}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button onClick={goToDashboard} variant="outline" className="flex-1">Dashboard</Button>
              <Button onClick={goToInvoice} className="flex-1 bg-primary hover:bg-primary/90">View Invoice</Button>
            </div>
          </>
        )}

        {/* Error */}
        {status === "error" && (
          <>
            <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
              <XCircle size={40} className="text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
              <p className="text-muted-foreground">
                We couldn't retrieve your payment status. Please check your invoices page.
              </p>
            </div>
            <Button onClick={() => setLocation("/client/invoices")} className="bg-primary hover:bg-primary/90">
              Go to Invoices
            </Button>
          </>
        )}

      </div>
    </div>
  );
}
