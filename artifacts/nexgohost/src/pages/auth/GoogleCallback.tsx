import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, AlertCircle, CheckCircle, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const ERROR_MESSAGES: Record<string, string> = {
  google_not_configured:     "Google Sign-In is not configured. Please contact the administrator.",
  google_denied:             "You cancelled the Google sign-in. You can try again anytime.",
  google_no_code:            "No authorisation code was received from Google. Please try again.",
  google_failed:             "Google sign-in failed. Please try again or use email and password.",
  google_domain_not_allowed: "Your Google account's email domain is not permitted. Please contact support.",
  account_suspended:         "Your account has been suspended. Please contact support.",
};

export default function GoogleCallback() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();

  const [status, setStatus] = useState<"loading" | "success" | "error" | "verify">("loading");
  const [message, setMessage] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [email, setEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const firstName = params.get("firstName") || "";
    const errorKey = params.get("error");
    const requiresVerification = params.get("requiresVerification") === "true";
    const tToken = params.get("tempToken") || "";
    const emailParam = params.get("email") || "";

    if (errorKey) {
      setStatus("error");
      setMessage(ERROR_MESSAGES[errorKey] || "Sign-in failed. Please try again.");
      setTimeout(() => setLocation("/login"), 3500);
      return;
    }

    if (requiresVerification && tToken) {
      setTempToken(tToken);
      setEmail(emailParam);
      setStatus("verify");
      return;
    }

    if (!token) {
      setStatus("error");
      setMessage("No authentication token received. Redirecting to login...");
      setTimeout(() => setLocation("/login"), 2500);
      return;
    }

    setStatus("success");
    setMessage(`Welcome${firstName ? `, ${firstName}` : ""}! Signing you in...`);
    const savedRedirect = localStorage.getItem("postLoginRedirect") || "/dashboard";
    localStorage.removeItem("postLoginRedirect");
    login(token);
    setTimeout(() => setLocation(savedRedirect), 1200);
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (verifyCode.length !== 6) return;
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tempToken}` },
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Verification failed");
      // verify-email now returns a full auth token — use it (not the scoped tempToken)
      const savedRedirect = localStorage.getItem("postLoginRedirect") || "/dashboard";
      localStorage.removeItem("postLoginRedirect");
      login(data.token);
      toast({ title: "Email verified!", description: "Welcome to Noehost." });
      setLocation(savedRedirect);
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tempToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Resend failed");
      toast({ title: "Code resent", description: `Check ${email || "your email"} for the new code.` });
    } catch (err: any) {
      toast({ title: "Resend failed", description: err.message, variant: "destructive" });
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-sm mx-auto px-6 w-full">

        {status === "loading" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
            <p className="text-muted-foreground text-sm">Completing sign-in...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle size={28} className="text-green-400" />
            </div>
            <p className="text-foreground font-medium">{message}</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
              <AlertCircle size={28} className="text-red-400" />
            </div>
            <p className="text-red-300 text-sm">{message}</p>
            <p className="text-muted-foreground text-xs">Redirecting to login page...</p>
          </>
        )}

        {status === "verify" && (
          <div className="glass-card p-7 rounded-2xl text-left space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MailCheck size={24} className="text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Verify your email</h2>
              <p className="text-sm text-muted-foreground mt-1">
                We sent a 6-digit code to{" "}
                <span className="text-foreground font-medium">{email || "your email"}</span>
              </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <Input
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="h-14 text-center text-2xl font-mono tracking-[0.5em] bg-background/50 border-white/10"
              />
              <Button
                type="submit"
                disabled={verifying || verifyCode.length !== 6}
                className="w-full h-12 font-semibold rounded-xl bg-primary hover:bg-primary/90"
              >
                {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & sign in"}
              </Button>
            </form>

            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full text-sm text-muted-foreground hover:text-foreground text-center transition-colors"
            >
              {resending ? "Resending..." : "Resend code"}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Wrong account?{" "}
              <a href="/login" className="text-primary hover:underline">Back to login</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
