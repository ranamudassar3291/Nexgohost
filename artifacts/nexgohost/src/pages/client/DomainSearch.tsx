import { useState } from "react";
import { Search, Check, X, Loader2, Globe, ShoppingCart, AlertCircle, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

const apiFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...((opts as any)?.headers) }, ...opts }).then(r => r.json());

interface DomainResult {
  domain: string;
  available: boolean | null;
  source: string;
  checked: boolean;
}

interface TldInfo {
  tld: string;
  price: number;
  renewalPrice: number;
  enabled: boolean;
}

const popularExtensions = [".com", ".net", ".org", ".pk", ".co.uk", ".io", ".store", ".online"];

export default function DomainSearch() {
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<DomainResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const { data: tlds = [] } = useQuery<TldInfo[]>({
    queryKey: ["domain-tlds"],
    queryFn: () => apiFetch("/api/domain-search/tlds"),
    staleTime: 300_000,
  });

  const enabledTlds = tlds.filter(t => t.enabled).map(t => t.tld);
  const displayTlds = enabledTlds.length > 0 ? enabledTlds : popularExtensions;

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const raw = query.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!raw) return;
    const baseName = raw.includes(".") ? raw.split(".")[0] : raw;
    setSearchTerm(raw);
    setSearching(true);
    setError(null);
    setResults([]);

    const domainsToCheck = raw.includes(".")
      ? [raw, ...displayTlds.filter(t => !raw.endsWith(t)).slice(0, 5).map(t => `${baseName}${t}`)]
      : displayTlds.slice(0, 8).map(t => `${baseName}${t}`);

    try {
      const checks = await Promise.all(
        domainsToCheck.map(domain =>
          apiFetch("/api/domain-search", {
            method: "POST",
            body: JSON.stringify({ domain }),
          }).then(r => ({ domain, available: r.available ?? null, source: r.source ?? "rdap", checked: true }))
            .catch(() => ({ domain, available: null, source: "error", checked: true }))
        )
      );
      setResults(checks);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function handleOrder(domain: string) {
    setLocation(`/order?domain=${encodeURIComponent(domain)}&registerDomain=true`);
  }

  const tldPriceMap = Object.fromEntries(tlds.map(t => [t.tld, t.price]));

  function getDomainPrice(domain: string): string {
    const ext = "." + domain.split(".").slice(1).join(".");
    const price = tldPriceMap[ext];
    if (!price) return "";
    return `Rs. ${price.toLocaleString("en-PK")}`;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
          <Globe size={28} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Domain Search</h1>
        <p className="text-muted-foreground text-sm">Find the perfect domain name for your website</p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="yoursite.com or just a name like 'mybusiness'"
          className="bg-card border-border text-base"
          autoFocus
        />
        <Button type="submit" disabled={searching || !query.trim()} className="shrink-0 gap-2 px-6">
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Search
        </Button>
      </form>

      {/* Popular extensions hint */}
      {!results.length && !searching && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Popular Extensions We Offer</p>
          <div className="flex flex-wrap gap-2">
            {displayTlds.slice(0, 12).map(ext => (
              <button
                key={ext}
                onClick={() => { setQuery(q => (q.split(".")[0] || "mybusiness") + ext); }}
                className="text-xs bg-secondary hover:bg-secondary/80 text-foreground px-3 py-1 rounded-full transition-colors border border-border"
              >
                {ext}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Results */}
      {(results.length > 0 || searching) && (
        <div className="space-y-3">
          {searchTerm && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Results for <span className="font-semibold text-foreground">{searchTerm}</span>
              </p>
              <Button variant="ghost" size="sm" onClick={() => { setResults([]); setQuery(searchTerm); }} className="gap-1.5 text-xs">
                <RefreshCw size={12} /> Search again
              </Button>
            </div>
          )}

          {searching && (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" /> Checking availability…
            </div>
          )}

          {results.map(r => (
            <div
              key={r.domain}
              className={`flex items-center justify-between rounded-2xl border px-5 py-4 transition-all ${
                r.available === true
                  ? "bg-green-500/5 border-green-500/25"
                  : r.available === false
                  ? "bg-card border-border opacity-70"
                  : "bg-card border-border"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  r.available === true ? "bg-green-500/15 text-green-400" :
                  r.available === false ? "bg-destructive/15 text-destructive" :
                  "bg-secondary text-muted-foreground"
                }`}>
                  {r.available === true ? <Check size={15} /> : r.available === false ? <X size={15} /> : <Globe size={15} />}
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{r.domain}</p>
                  {r.available === true && getDomainPrice(r.domain) && (
                    <p className="text-xs text-muted-foreground">{getDomainPrice(r.domain)}/year</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {r.available === true ? (
                  <>
                    <Badge className="bg-green-500/15 text-green-400 border-green-500/25 text-xs">Available</Badge>
                    <Button size="sm" onClick={() => handleOrder(r.domain)} className="gap-1.5 text-xs">
                      <ShoppingCart size={12} /> Add to Order
                    </Button>
                  </>
                ) : r.available === false ? (
                  <Badge variant="secondary" className="text-xs">Taken</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Unknown</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
