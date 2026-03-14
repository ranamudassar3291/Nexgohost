import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Google Sign-In is not configured. Please contact the administrator.",
  google_denied:         "You cancelled the Google sign-in. You can try again anytime.",
  google_no_code:        "No authorisation code was received from Google. Please try again.",
  google_failed:         "Google sign-in failed. Please try again or use email and password.",
  google_domain_not_allowed: "Your Google account's email domain is not permitted. Please contact support.",
  account_suspended:     "Your account has been suspended. Please contact support.",
};

export default function GoogleCallback() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const firstName = params.get("firstName");
    const error = params.get("error");

    if (error) {
      setStatus("error");
      setMessage(ERROR_MESSAGES[error] || "Sign-in failed. Please try again.");
      setTimeout(() => setLocation("/client/login"), 3500);
      return;
    }

    if (!token) {
      setStatus("error");
      setMessage("No authentication token received. Redirecting to login...");
      setTimeout(() => setLocation("/client/login"), 2500);
      return;
    }

    setStatus("success");
    setMessage(`Welcome${firstName ? `, ${firstName}` : ""}! Signing you in...`);
    login(token);
    setTimeout(() => setLocation("/client/dashboard"), 1200);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-sm mx-auto px-6">
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
      </div>
    </div>
  );
}
