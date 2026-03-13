import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

// ─── useRouteLogger ───────────────────────────────────────────────────────────
// Logs every client-side route change to the browser console.
// Format: [ROUTE] /client/domains | user=john@example.com | role=client | ✅ ALLOWED
//
// Mount once inside the router root so all navigations are captured.
export function useRouteLogger() {
  const [location] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const userStr = user?.email ?? "anonymous";
    const role    = user?.role  ?? "none";

    // Determine if user is allowed on this path based on the prefix
    let status = "✅ ALLOWED";
    if (!user) {
      status = "🔒 UNAUTHENTICATED";
    } else if (location.startsWith("/admin") && user.role !== "admin") {
      status = "🚫 FORBIDDEN (requires admin)";
    } else if (location.startsWith("/client") && user.role !== "client") {
      status = "🚫 FORBIDDEN (requires client)";
    }

    console.log(`[ROUTE] ${location} | user=${userStr} | role=${role} | ${status}`);
  }, [location, user]);
}
