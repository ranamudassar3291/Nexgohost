import { ShieldX, ArrowLeft, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { dashboardByRole } from "@/config/routes";

interface ForbiddenProps {
  requiredRole?: "admin" | "client";
  attemptedPath?: string;
}

export default function Forbidden({ requiredRole, attemptedPath }: ForbiddenProps) {
  const { user, logout } = useAuth();

  const userRole = user?.role as "admin" | "client" | undefined;
  const homePath = userRole ? dashboardByRole[userRole] : "/login";

  const roleLabel: Record<string, string> = {
    admin: "Administrator",
    client: "Client",
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-lg text-center space-y-8"
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-28 h-28 rounded-3xl bg-destructive/10 border border-destructive/25 flex items-center justify-center shadow-[0_0_60px_-10px_rgba(239,68,68,0.3)]">
              <ShieldX size={52} className="text-destructive" />
            </div>
            <span className="absolute -top-3 -right-3 text-4xl font-display font-black text-destructive/20 select-none">
              403
            </span>
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-3">
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">
            Access Forbidden
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            You don't have permission to view this page.
          </p>
        </div>

        {/* Context Card */}
        <div className="bg-card border border-border rounded-2xl p-5 text-left space-y-3 shadow-sm">
          {attemptedPath && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Requested path</span>
              <code className="bg-secondary px-2 py-0.5 rounded text-foreground font-mono text-xs">
                {attemptedPath}
              </code>
            </div>
          )}
          {user && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Logged in as</span>
              <span className="text-foreground font-medium">{user.email}</span>
            </div>
          )}
          {userRole && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your role</span>
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                {roleLabel[userRole] ?? userRole}
              </span>
            </div>
          )}
          {requiredRole && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Required role</span>
              <span className="px-2.5 py-0.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                {roleLabel[requiredRole] ?? requiredRole}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={homePath}>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-[0_0_20px_-4px_rgba(139,92,246,0.4)] text-sm">
              <ArrowLeft size={16} />
              Go to my Dashboard
            </button>
          </Link>
          {user && (
            <button
              onClick={logout}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-sm"
            >
              <LogOut size={16} />
              Sign in as different user
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
