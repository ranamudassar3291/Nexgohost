import { useState } from "react";
import { Star, X, MessageSquareHeart, Send, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Step = "closed" | "open" | "sent";

export function FeedbackWidget() {
  const [step, setStep] = useState<Step>("closed");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (rating === 0) { toast({ title: "Please select a rating", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/client/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating, message: message.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setStep("sent");
    } catch {
      toast({ title: "Could not send feedback. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const labels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  if (step === "closed") {
    return (
      <button
        onClick={() => setStep("open")}
        className="fixed bottom-20 left-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold text-white shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)", boxShadow: "0 4px 20px rgba(109,40,217,0.35)" }}
        title="Share your feedback"
      >
        <MessageSquareHeart size={14} />
        Feedback
      </button>
    );
  }

  if (step === "sent") {
    return (
      <div
        className="fixed bottom-20 left-4 z-50 w-72 rounded-2xl shadow-2xl border border-primary/20 p-6 flex flex-col items-center gap-3 text-center"
        style={{ background: "white" }}
      >
        <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
          <CheckCircle2 className="text-green-500" size={24} />
        </div>
        <h3 className="font-bold text-foreground text-base">Thank you!</h3>
        <p className="text-sm text-muted-foreground">Your feedback helps us improve Noehost for everyone.</p>
        <button
          onClick={() => { setStep("closed"); setRating(0); setMessage(""); }}
          className="mt-1 text-xs text-primary font-medium hover:underline"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-20 left-4 z-50 w-76 rounded-2xl shadow-2xl border border-border overflow-hidden"
      style={{ background: "white", width: "300px" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" }}
      >
        <div className="flex items-center gap-2">
          <MessageSquareHeart size={15} className="text-white/90" />
          <span className="text-sm font-bold text-white">Rate Your Experience</span>
        </div>
        <button onClick={() => setStep("closed")} className="text-white/70 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-3">How would you rate Noehost today?</p>
          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                className="transition-transform hover:scale-125 active:scale-110"
              >
                <Star
                  size={28}
                  className={`transition-colors ${(hover || rating) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                />
              </button>
            ))}
          </div>
          {(hover || rating) > 0 && (
            <p className="text-xs font-semibold text-primary mt-1">{labels[hover || rating]}</p>
          )}
        </div>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Any comments? (optional)"
          rows={3}
          className="w-full text-sm border border-border rounded-xl px-3 py-2.5 resize-none outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all bg-secondary/30 placeholder:text-muted-foreground/50"
        />

        <button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" }}
        >
          {submitting ? <span className="animate-spin">⏳</span> : <Send size={14} />}
          {submitting ? "Sending..." : "Send Feedback"}
        </button>
      </div>
    </div>
  );
}
