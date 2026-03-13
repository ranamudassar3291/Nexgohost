import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLogin } from "@workspace/api-client-react";
import { Link, useLocation, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, ShieldCheck, AlertCircle, User } from "lucide-react";

export default function AdminLogin() {
  const { user, login } = useAuth();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Already logged-in users get bounced to their dashboard (using Redirect, not setLocation during render)
  if (user) {
    return <Redirect to={user.role === "admin" ? "/admin/dashboard" : "/client/dashboard"} />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);

    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (data) => {
          if (data.user.role !== "admin") {
            setInlineError(
              "This portal is for administrators only. Please use the Client Portal to sign in."
            );
            return;
          }
          login(data.token);
          setLocation("/admin/dashboard");
        },
        onError: (error: any) => {
          setInlineError(
            error?.response?.data?.message ||
              error?.message ||
              "Invalid email or password. Please try again."
          );
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`}
          alt=""
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="w-full max-w-md z-10 p-4"
      >
        <div className="glass-card p-8 rounded-3xl relative overflow-hidden border border-primary/20">
          {/* Glow blobs */}
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/25 rounded-full blur-[60px]" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-blue-600/15 rounded-full blur-[60px]" />

          {/* Header */}
          <div className="relative z-10 flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <img
                src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
                alt="Nexgohost"
                className="w-16 h-16 drop-shadow-[0_0_15px_rgba(139,92,246,0.6)]"
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                <ShieldCheck size={12} className="text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground text-center">
              Admin Portal
            </h1>
            <p className="text-muted-foreground text-center mt-1 text-sm">
              Sign in with your administrator credentials
            </p>
            {/* Portal badge */}
            <div className="mt-3 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 flex items-center gap-1.5 text-xs text-primary font-medium">
              <ShieldCheck size={12} />
              Administrator Access
            </div>
          </div>

          {/* Inline error */}
          {inlineError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 mb-5 flex items-start gap-3 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{inlineError}</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="relative z-10 space-y-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground/80 ml-1">
                Admin Email
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setInlineError(null); }}
                placeholder="admin@nexgohost.com"
                className="bg-background/50 border-white/10 focus:border-primary focus:ring-primary/20 h-12 rounded-xl text-base placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground/80 ml-1">
                Password
              </label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); setInlineError(null); }}
                placeholder="••••••••"
                className="bg-background/50 border-white/10 focus:border-primary focus:ring-primary/20 h-12 rounded-xl text-base"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Sign In to Admin Panel <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center relative z-10 space-y-2">
            <p className="text-xs text-muted-foreground/60 italic">
              Admin access only. Unauthorized access attempts are logged.
            </p>
            <p className="text-sm text-muted-foreground">
              Not an admin?{" "}
              <Link
                href="/client/login"
                className="text-primary font-medium hover:underline underline-offset-4 decoration-primary/50 inline-flex items-center gap-1"
              >
                <User size={13} /> Go to Client Portal
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
