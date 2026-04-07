import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, Check, X, Loader2, Globe, Gift, AlertCircle, CheckCircle2, ArrowLeft, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const BRAND = "linear-gradient(135deg, #4F46E5 0%, #6366F1 60%, #818CF8 100%)";
const BRAND_SOLID = "#4F46E5";

const CONFETTI_COLORS = ["#4F46E5", "#6366F1", "#818CF8", "#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#F97316"];

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${2 + (i * 2.45) % 96}%`,
    delay: `${(i * 0.07) % 1.8}s`,
    duration: `${1.9 + (i * 0.11) % 1.2}s`,
    size: i % 3 === 0 ? 11 : i % 3 === 1 ? 7 : 5,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10" aria-hidden="true">
      {pieces.map(p => (
        <div key={p.id} style={{
          position: "absolute", top: "-14px", left: p.left,
          width: p.size, height: p.size,
          backgroundColor: p.color,
          borderRadius: p.id % 4 === 0 ? "50%" : "2px",
          animationName: "confettiFallRD",
          animationDuration: p.duration,
          animationDelay: p.delay,
          animationTimingFunction: "ease-in",
          animationIterationCount: "1",
          animationFillMode: "forwards",
        }} />
      ))}
      <style>{`
        @keyframes confettiFallRD {
          0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(380px) rotate(720deg) scale(0.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") || "";
  return fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((opts as any)?.headers),
    },
    ...opts,
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`);
    return data;
  });
}

interface SearchResult {
  domain: string;
  available: boolean | null;
  status: "available" | "taken" | "unknown";
  registerPrice: number | null;
  extension: string;
  checkedVia: string;
}

interface FreeDomainInfo {
  serviceId: string;
  planName: string;
  allowedTlds: string[];
  freeDomainAvailable: boolean;
}

export default function RegisterDomain() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const claimToken = new URLSearchParams(window.location.search).get("claim_token") ?? "";

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<string | null>(null);
  const [confettiActive, setConfettiActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: info, isLoading: infoLoading, error: infoError } = useQuery<FreeDomainInfo>({
    queryKey: ["free-domain-info", claimToken],
    queryFn: () => apiFetch(`/api/client/hosting/${claimToken}/free-domain-info`),
    enabled: !!claimToken,
    retry: false,
  });

  useEffect(() => {
    if (!claimToken) navigate("/client/dashboard");
  }, [claimToken]);

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const raw = query.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!raw) return;
    const baseName = raw.includes(".") ? raw.split(".")[0] : raw;
    setSearching(true);
    setError(null);
    setResults([]);
    try {
      const data = await apiFetch("/api/domain-search", {
        method: "POST",
        body: JSON.stringify({ domain: baseName }),
      });
      const list: SearchResult[] = Array.isArray(data.results) ? data.results : [];
      const allowedTlds = info?.allowedTlds ?? [".com", ".net", ".org"];
      const filtered = list.filter(r => {
        const ext = r.extension.startsWith(".") ? r.extension : `.${r.extension}`;
        return allowedTlds.includes(ext.toLowerCase());
      });
      setResults(filtered.length > 0 ? filtered : list.filter(r => {
        const ext = r.extension.startsWith(".") ? r.extension : `.${r.extension}`;
        return [".com", ".net", ".org"].includes(ext.toLowerCase());
      }));
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  async function handleClaim(domain: string) {
    if (!claimToken) return;
    setClaiming(domain);
    try {
      await apiFetch(`/api/client/hosting/${claimToken}/claim-free-domain`, {
        method: "POST",
        body: JSON.stringify({ domain }),
      });
      setClaimed(domain);
      setConfettiActive(true);
      setTimeout(() => setConfettiActive(false), 4000);
    } catch (err: any) {
      toast({ title: "Claim Failed", description: err.message, variant: "destructive" });
    } finally {
      setClaiming(null);
    }
  }

  if (!claimToken) return null;

  if (infoLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Loading your free domain offer…</p>
      </div>
    );
  }

  if (infoError || !info) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto border border-red-500/20">
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground">No Free Domain Available</h2>
        <p className="text-muted-foreground text-sm">
          {(infoError as any)?.message ?? "This hosting plan doesn't have a free domain available, or it's already been claimed."}
        </p>
        <Button onClick={() => navigate("/client/dashboard")} variant="outline" className="gap-2">
          <ArrowLeft size={14} /> Back to Dashboard
        </Button>
      </div>
    );
  }

  if (claimed) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <div className="relative rounded-3xl overflow-hidden border border-violet-500/30 text-center p-10 space-y-5"
          style={{ background: "linear-gradient(135deg, #0f0523 0%, #1a0540 40%, #2d0a6b 100%)" }}>
          <Confetti active={confettiActive} />
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(112,26,254,0.5) 0%, transparent 70%)" }} />
          <div className="relative z-[1] flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"
              style={{ background: BRAND, boxShadow: "0 0 60px rgba(112,26,254,0.6)" }}>
              <CheckCircle2 size={36} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Domain Claimed! 🎉</h2>
              <p className="text-violet-200 text-sm mt-2">
                <span className="font-mono font-bold text-white">{claimed}</span> has been successfully registered and linked to your hosting plan.
              </p>
              <p className="text-violet-300/70 text-xs mt-2">
                Your domain will be activated within a few minutes. You can manage it from the Domains section.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <Button onClick={() => navigate("/client/domains")}
                className="gap-2 text-white" style={{ background: BRAND, border: "none" }}>
                <Globe size={14} /> Manage Domains
              </Button>
              <Button onClick={() => navigate("/client/dashboard")} variant="outline"
                className="gap-2 border-violet-500/30 text-violet-200 hover:bg-violet-500/10">
                <ArrowLeft size={14} /> Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const allowedTlds = info.allowedTlds;

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden text-white"
        style={{ background: BRAND }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 80% 50%, #fff 0%, transparent 60%)" }} />
        <div className="relative px-6 py-5 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
            <Gift size={26} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-base font-black tracking-tight">You have 1 FREE Domain!</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/20 border border-yellow-400/30 text-yellow-300">
                INCLUDED
              </span>
            </div>
            <p className="text-white/80 text-sm">
              Your <span className="font-semibold text-white">{info.planName}</span> plan includes a free domain for the first year.
              Search and claim yours below — it won't cost a thing.
            </p>
          </div>
          <div className="shrink-0 hidden sm:flex items-center gap-1 text-yellow-300">
            {[0, 1, 2, 3, 4].map(i => <Star key={i} size={14} fill="currentColor" />)}
          </div>
        </div>
      </div>

      {/* Eligible TLDs strip */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-xs text-muted-foreground font-medium">Free extensions on your plan:</span>
        {allowedTlds.map(tld => (
          <span key={tld}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border"
            style={{ background: "rgba(79,70,229,0.08)", borderColor: "rgba(79,70,229,0.25)", color: BRAND_SOLID }}>
            <Sparkles size={10} />
            {tld} — FREE
          </span>
        ))}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. mybusiness or mybusiness.com"
            className="pl-10 h-12 text-base bg-card border-border"
            autoFocus
          />
        </div>
        <Button
          type="submit"
          disabled={searching || !query.trim()}
          className="h-12 px-7 gap-2 text-sm font-semibold text-white"
          style={{ background: BRAND, border: "none" }}
        >
          {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          Search
        </Button>
      </form>

      {/* Back */}
      <button onClick={() => navigate("/client/dashboard")}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={13} /> Back to Dashboard
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Searching spinner */}
      {searching && (
        <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Checking domain availability…</span>
        </div>
      )}

      {/* Results */}
      {!searching && results.length > 0 && (
        <div className="space-y-2">
          {results.map(r => {
            const isAvailable = r.status === "available";
            const isTaken = r.status === "taken";
            const ext = r.extension.startsWith(".") ? r.extension : `.${r.extension}`;
            const isEligible = allowedTlds.includes(ext.toLowerCase());
            const isBusy = claiming === r.domain;

            return (
              <div
                key={r.domain}
                className={`flex items-center justify-between rounded-2xl border px-5 py-4 transition-all ${
                  isAvailable && isEligible
                    ? "border-violet-400/40 hover:border-violet-500/50"
                    : isTaken
                    ? "bg-card border-border opacity-60"
                    : "bg-card border-border"
                }`}
                style={isAvailable && isEligible ? { background: "linear-gradient(135deg, rgba(79,70,229,0.05) 0%, rgba(99,102,241,0.03) 100%)" } : {}}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isAvailable && isEligible ? "bg-violet-500/15 text-violet-500" :
                    isTaken ? "bg-muted text-muted-foreground" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isAvailable && isEligible ? <Gift size={15} /> : isTaken ? <X size={15} /> : <Globe size={15} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate font-mono">{r.domain}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isAvailable && isEligible && (
                        <>
                          <span className="text-xs line-through text-muted-foreground">Regular price</span>
                          <span className="text-sm font-black text-green-500">FREE</span>
                          <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/20 text-[10px] px-1.5 py-0">
                            1st Year
                          </Badge>
                        </>
                      )}
                      {isTaken && <p className="text-xs text-muted-foreground">Already registered</p>}
                      {r.status === "unknown" && <p className="text-xs text-muted-foreground">Could not verify availability</p>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {isAvailable && isEligible ? (
                    <>
                      <Badge className="bg-green-500/15 text-green-500 border-green-500/25 text-xs hidden sm:flex">
                        Available
                      </Badge>
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs h-8 text-white"
                        style={{ background: BRAND, border: "none" }}
                        onClick={() => handleClaim(r.domain)}
                        disabled={!!claiming}
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Gift size={12} />}
                        {isBusy ? "Claiming…" : "Claim Free"}
                      </Button>
                    </>
                  ) : isTaken ? (
                    <Badge variant="secondary" className="text-xs">Taken</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs text-muted-foreground">Unavailable</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state after search */}
      {!searching && results.length === 0 && query && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <Globe size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No results yet. Hit Search to check availability.</p>
        </div>
      )}

      {/* Pre-search info */}
      {!searching && results.length === 0 && !query && (
        <div className="rounded-2xl border border-border bg-card/50 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-green-500 shrink-0" />
            <p className="text-sm text-foreground font-medium">How to claim your free domain</p>
          </div>
          <ol className="space-y-3 text-sm text-muted-foreground pl-2">
            <li className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white mt-0.5"
                style={{ background: BRAND }}>1</span>
              Type your desired domain name in the search box above
            </li>
            <li className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white mt-0.5"
                style={{ background: BRAND }}>2</span>
              We'll check availability for your free extensions ({allowedTlds.join(", ")})
            </li>
            <li className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white mt-0.5"
                style={{ background: BRAND }}>3</span>
              Click <strong>"Claim Free"</strong> on your chosen domain — no payment needed
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
