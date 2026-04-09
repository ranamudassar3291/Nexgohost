import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Mail, ExternalLink, Loader2, AlertCircle, ArrowLeft, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/hooks/use-branding";

interface HostingService {
  id: string;
  domain: string;
  status: string;
  webmailUrl?: string | null;
}

export default function Webmail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const branding = useBranding();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [autoLaunched, setAutoLaunched] = useState(false);

  const { data: service, isLoading } = useQuery<HostingService>({
    queryKey: ["client-hosting-service", id],
    queryFn: async () => {
      const res = await fetch(`/api/client/hosting/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load hosting service");
      return res.json();
    },
    enabled: !!id && !!token,
  });

  const handleLaunchWebmail = async () => {
    setLaunching(true);
    setLaunchError(null);
    try {
      const res = await fetch(`/api/client/hosting/${id}/email/webmail`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to launch webmail");
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      setLaunchError(err.message || "Failed to launch webmail");
    } finally {
      setLaunching(false);
    }
  };

  // Auto-launch on mount for convenience
  useEffect(() => {
    if (service && !autoLaunched && service.status === "active") {
      setAutoLaunched(true);
      handleLaunchWebmail();
    }
  }, [service]);

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      {/* Back nav */}
      <button
        onClick={() => setLocation(`/client/hosting/${id}`)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={15} /> Back to Hosting Panel
      </button>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Brand color header */}
        <div className="px-6 py-5 flex items-center gap-4" style={{ background: branding.primaryColor }}>
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
            <Mail size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">Webmail Access</h2>
            <p className="text-white/70 text-sm">
              {isLoading ? "Loading…" : service?.domain || "Your Hosting"}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={22} className="animate-spin text-muted-foreground" />
            </div>
          ) : service?.status !== "active" ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700">
              <AlertCircle size={18} className="shrink-0" />
              <div>
                <p className="font-semibold text-sm">Service Not Active</p>
                <p className="text-xs mt-0.5">Webmail is only available for active hosting services.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Info cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 flex items-center gap-3">
                  <Globe size={16} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Domain</p>
                    <p className="text-sm font-semibold text-foreground truncate">{service?.domain || "—"}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 flex items-center gap-3">
                  <Lock size={16} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Access</p>
                    <p className="text-sm font-semibold text-foreground">SSO Login</p>
                  </div>
                </div>
              </div>

              {/* Error state */}
              {launchError && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600">
                  <AlertCircle size={16} className="shrink-0" />
                  <p className="text-sm">{launchError}</p>
                </div>
              )}

              {/* Auto-launch note */}
              {!launchError && autoLaunched && (
                <div className="rounded-xl bg-secondary/40 border border-border px-4 py-3 text-sm text-muted-foreground">
                  Webmail launched in a new tab. If it didn't open, click the button below.
                </div>
              )}

              {/* Launch button */}
              <Button
                className="w-full gap-2 text-white"
                style={{ background: branding.primaryColor }}
                onClick={handleLaunchWebmail}
                disabled={launching}
              >
                {launching
                  ? <><Loader2 size={16} className="animate-spin" /> Launching…</>
                  : <><ExternalLink size={16} /> Open Webmail in New Tab</>
                }
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Opens {branding.siteName} Webmail — you'll be logged in automatically via Single Sign-On.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
