/**
 * Distraction-free checkout layout — no sidebar, no dashboard header.
 * Shows only: Noehost logo + secure indicators.
 * The page inside renders its own step bar and content.
 *
 * allowGuest: when true, unauthenticated visitors can browse (used for
 * public direct-order links like /order/add/:id and /order/group/:id).
 * When false (default), requires login before rendering.
 */
import { ReactNode } from "react";
import { Link, Redirect } from "wouter";
import { Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface Props { children: ReactNode; allowGuest?: boolean; }

export function CheckoutLayout({ children, allowGuest = false }: Props) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4F46E5]"/>
      </div>
    );
  }

  if (!user && !allowGuest) return <Redirect to="/client/login"/>;

  return (
    <div className="min-h-screen bg-[#F8F9FB]" style={{ fontFamily: "'Inter', 'Public Sans', sans-serif" }}>
      {/* ── Minimal Header ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href={user ? "/client/dashboard" : "/"} className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-white text-[15px] shadow-lg"
              style={{ background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)" }}>
              N
            </div>
            <span className="text-[17px] font-extrabold text-gray-900 tracking-tight">Noehost</span>
          </Link>

          {/* Trust signals + optional Sign In link for guests */}
          <div className="flex items-center gap-3 sm:gap-5 text-[12px] text-gray-500">
            <span className="hidden sm:flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-green-500"/> SSL Secured
            </span>
            <span className="flex items-center gap-1.5">
              <Lock size={12} style={{ color: "#4F46E5" }}/> Secure Checkout
            </span>
            <span className="hidden sm:block text-gray-300">|</span>
            <span className="hidden sm:block">30-Day Money-Back</span>
            {!user && allowGuest && (
              <>
                <span className="text-gray-300">|</span>
                <Link href="/client/login" className="font-semibold text-[#4F46E5] hover:underline no-underline">Sign in</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Page content — full width ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        {children}
      </div>
    </div>
  );
}
