import { useState, useRef } from "react";
import {
  Search, Check, X, Loader2, Globe, ShoppingCart, AlertCircle,
  ExternalLink, Tag, Sparkles, ChevronRight, Trash2, Server, X as XIcon,
  HelpCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useCurrency } from "@/context/CurrencyProvider";
import { useToast } from "@/hooks/use-toast";

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

interface TldInfo {
  extension: string;
  tld: string;
  registerPrice: number;
  register2YearPrice: number | null;
  register3YearPrice: number | null;
  renewPrice: number;
  isFreeWithHosting: boolean;
  sortOrder: number;
  showInSuggestions: boolean;
}

interface SearchResult {
  domain: string;
  available: boolean | null;
  status: "available" | "taken" | "unknown";
  registerPrice: number | null;
  register2YearPrice: number | null;
  register3YearPrice: number | null;
  renewPrice: number | null;
  isFreeWithHosting: boolean;
  extension: string;
  checkedVia: string;
}

interface PromoConfig {
  enabled: boolean;
  tld: string;
  price: number;
  originalPrice: number;
  text: string;
  years: number;
}

interface CartItem {
  domain: string;
  period: number;
  price: number;
  originalPrice: number | null;
  isFreeWithHosting: boolean;
}

type Period = 1 | 2 | 3;

const BRAND = "linear-gradient(135deg, #4F46E5 0%, #6366F1 60%, #818CF8 100%)";

export default function DomainSearch() {
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [promoDismissed, setPromoDismissed] = useState(false);
  const [, setLocation] = useLocation();
  const { formatPrice } = useCurrency();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: rawTlds } = useQuery({
    queryKey: ["domain-tlds-v2"],
    queryFn: () => apiFetch("/api/domain-search/tlds").catch(() => []),
    staleTime: 300_000,
  });
  const tlds: TldInfo[] = Array.isArray(rawTlds) ? rawTlds : [];

  const { data: promo } = useQuery<PromoConfig>({
    queryKey: ["domain-promo"],
    queryFn: () => apiFetch("/api/domain-search/promo").catch(() => null),
    staleTime: 60_000,
  });

  function getPriceForPeriod(r: Pick<TldInfo | SearchResult, "registerPrice" | "register2YearPrice" | "register3YearPrice">): { price: number | null; original: number | null } {
    const base = r.registerPrice;
    if (period === 3 && r.register3YearPrice) {
      return { price: r.register3YearPrice / 3, original: base };
    }
    if (period === 2 && r.register2YearPrice) {
      return { price: r.register2YearPrice / 2, original: base };
    }
    return { price: base, original: null };
  }

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const raw = query.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!raw) return;
    const baseName = raw.includes(".") ? raw.split(".")[0] : raw;
    setSearchTerm(baseName);
    setSearching(true);
    setError(null);
    setResults([]);

    try {
      const data = await apiFetch("/api/domain-search", {
        method: "POST",
        body: JSON.stringify({ domain: baseName }),
      });
      const list: SearchResult[] = Array.isArray(data.results) ? data.results : [];
      setResults(list);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function handleQuickSearch(tld: string) {
    const baseName = query.split(".")[0] || "mybusiness";
    setQuery(baseName + tld);
    setTimeout(() => handleSearch(), 0);
  }

  function addToCart(r: SearchResult) {
    const { price, original } = getPriceForPeriod(r);
    if (!price) return;
    let alreadyIn = false;
    setCart(prev => {
      if (prev.find(c => c.domain === r.domain)) { alreadyIn = true; return prev; }
      return [...prev, {
        domain: r.domain,
        period,
        price: price * period,
        originalPrice: original ? original * period : null,
        isFreeWithHosting: r.isFreeWithHosting ?? false,
      }];
    });
    if (!alreadyIn) {
      toast({
        title: "Added to cart!",
        description: `${r.domain} (${period} yr${period > 1 ? "s" : ""}) — ${formatPrice(price * period)}`,
      });
    }
    setCartOpen(true);
  }

  function removeFromCart(domain: string) {
    setCart(prev => prev.filter(c => c.domain !== domain));
  }

  function proceedToCheckout() {
    if (!cart.length) return;
    const primary = cart[0];
    setLocation(`/client/domains?tab=order&domain=${encodeURIComponent(primary.domain)}`);
  }

  const tldMap = Object.fromEntries(tlds.map(t => [t.tld.startsWith(".") ? t.tld : `.${t.tld}`, t]));
  const featuredTlds = tlds.filter(t => t.showInSuggestions).slice(0, 12);

  const showPromo = promo?.enabled && !promoDismissed;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Promo Banner */}
      {showPromo && promo && (
        <div className="relative rounded-2xl overflow-hidden text-white" style={{ background: BRAND }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 80% 50%, #fff 0%, transparent 60%)" }} />
          <div className="relative px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Tag size={18} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">{promo.text}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-white/60 text-xs line-through">{formatPrice(promo.originalPrice)}/yr</span>
                  <span className="text-yellow-300 text-sm font-black">{formatPrice(promo.price)}</span>
                  <span className="text-white/80 text-xs">for 1st year</span>
                  <span className="bg-yellow-400/20 border border-yellow-400/30 text-yellow-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {promo.years}yr DEAL
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { setPeriod(promo.years as Period); inputRef.current?.focus(); }}
                className="hidden sm:block px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold transition-colors"
              >
                Select {promo.years}yr →
              </button>
              <button onClick={() => setPromoDismissed(true)} className="opacity-60 hover:opacity-100 transition-opacity">
                <XIcon size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-2 pt-2">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: BRAND }}
        >
          <Globe size={26} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Find Your Perfect Domain</h1>
        <p className="text-muted-foreground text-sm">
          Instant availability check • Real pricing from your registrar
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="mybusiness.com or just 'mybusiness'"
            className="pl-10 h-12 text-base bg-card border-border"
            autoFocus
          />
        </div>
        <Button
          type="submit"
          disabled={searching || !query.trim()}
          className="h-12 px-7 gap-2 text-sm font-semibold"
          style={{ background: BRAND, border: "none" }}
        >
          {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          Search
        </Button>
        {cart.length > 0 && (
          <Button
            type="button"
            variant="outline"
            className="h-12 px-4 gap-2 relative"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart size={16} />
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
              style={{ background: BRAND }}>
              {cart.length}
            </span>
          </Button>
        )}
      </form>

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium mr-1">Registration period:</span>
        {([1, 2, 3] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
              period === p
                ? "text-white border-transparent"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
            style={period === p ? { background: BRAND, borderColor: "transparent" } : {}}
          >
            {p} yr{p > 1 ? "s" : ""}
            {p === 3 && (
              <span className={`ml-1.5 text-[10px] font-bold ${period === 3 ? "text-yellow-300" : "text-primary"}`}>
                DEAL
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Results */}
      {(results.length > 0 || searching) && (
        <div className="space-y-2">
          {searchTerm && !searching && (
            <p className="text-sm text-muted-foreground pb-1">
              Results for <span className="font-semibold text-foreground">{searchTerm}</span>
              <span className="ml-2 text-xs opacity-60">· {results.length} extensions checked</span>
            </p>
          )}
          {searching && (
            <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Checking domain availability via RDAP &amp; DNS…</span>
            </div>
          )}
          {results.map(r => {
            const { price, original } = getPriceForPeriod(r);
            const isAvailable = r.status === "available";
            const isTaken = r.status === "taken";
            const inCart = cart.some(c => c.domain === r.domain);
            const extKey = r.extension.startsWith(".") ? r.extension : `.${r.extension}`;
            const tldData = tldMap[extKey];
            const promoMatch = promo?.enabled && period === promo.years && r.extension === promo.tld;

            return (
              <div
                key={r.domain}
                className={`flex items-center justify-between rounded-2xl border px-5 py-4 transition-all ${
                  isAvailable
                    ? "bg-green-500/5 border-green-500/25 hover:border-green-500/40"
                    : isTaken
                    ? "bg-card border-border opacity-60"
                    : "bg-card border-border"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isAvailable ? "bg-green-500/15 text-green-500" :
                    isTaken ? "bg-muted text-muted-foreground" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isAvailable ? <Check size={15} /> : isTaken ? <X size={15} /> : <Globe size={15} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate font-mono">{r.domain}</p>
                    {isAvailable && price && (
                      <div className="flex items-center gap-2 mt-0.5">
                        {promoMatch ? (
                          <>
                            <span className="text-xs line-through text-muted-foreground">
                              {formatPrice(promo!.originalPrice)}/yr
                            </span>
                            <span className="text-xs font-bold text-green-500">
                              {formatPrice(promo!.price)}/1st yr
                            </span>
                          </>
                        ) : (
                          <>
                            {original && period > 1 && (
                              <span className="text-xs line-through text-muted-foreground">
                                {formatPrice(original)}/yr
                              </span>
                            )}
                            <span className={`text-xs font-medium ${original && period > 1 ? "text-green-500" : "text-muted-foreground"}`}>
                              {formatPrice(price)}/yr
                            </span>
                            {period > 1 && original && (
                              <Badge className="bg-green-500/15 text-green-500 border-green-500/20 text-[10px] px-1.5 py-0">
                                {Math.round((1 - price / original) * 100)}% OFF
                              </Badge>
                            )}
                          </>
                        )}
                        {tldData?.isFreeWithHosting && (
                          <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/20 text-[10px] px-1.5 py-0">
                            FREE w/ Hosting
                          </Badge>
                        )}
                      </div>
                    )}
                    {isTaken && (
                      <p className="text-xs text-muted-foreground mt-0.5">This domain is already registered</p>
                    )}
                    {r.status === "unknown" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Couldn't verify — <a href={`https://lookup.icann.org/en/lookup?name=${encodeURIComponent(r.domain)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-primary underline hover:no-underline">check manually</a>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {isAvailable ? (
                    <>
                      <Badge className="bg-green-500/15 text-green-500 border-green-500/25 text-xs hidden sm:flex">
                        Available
                      </Badge>
                      {inCart ? (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setCartOpen(true)}>
                          <ShoppingCart size={12} /> In Cart
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="gap-1.5 text-xs h-8"
                          style={{ background: BRAND, border: "none" }}
                          onClick={() => addToCart(r)}
                        >
                          <ShoppingCart size={12} /> Add to Cart
                        </Button>
                      )}
                    </>
                  ) : isTaken ? (
                    <>
                      <Badge variant="secondary" className="text-xs">Taken</Badge>
                      <a
                        href={`https://lookup.icann.org/en/lookup?name=${encodeURIComponent(r.domain)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                          <ExternalLink size={12} /> WHOIS
                        </Button>
                      </a>
                    </>
                  ) : (
                    <a
                      href={`https://lookup.icann.org/en/lookup?name=${encodeURIComponent(r.domain)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 text-muted-foreground">
                        <HelpCircle size={12} /> Check Manually
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Featured TLD Grid — shown before search */}
      {!results.length && !searching && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Tag size={14} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Popular Extensions — Click to search
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {featuredTlds.map(t => {
              const ext = t.tld || (t.extension.startsWith(".") ? t.extension : `.${t.extension}`);
              const { price, original } = getPriceForPeriod(t);
              const isPromoTld = promo?.enabled && period === promo.years && ext === promo.tld;
              return (
                <button
                  key={ext}
                  onClick={() => handleQuickSearch(ext)}
                  className="group text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-base font-bold text-foreground">{ext}</span>
                    {t.isFreeWithHosting && (
                      <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/20 text-[9px] px-1 py-0">FREE</Badge>
                    )}
                  </div>
                  {price ? (
                    <div className="space-y-0.5">
                      {isPromoTld ? (
                        <>
                          <p className="text-xs line-through text-muted-foreground">{formatPrice(promo!.originalPrice)}/yr</p>
                          <p className="text-sm font-bold text-green-500">{formatPrice(promo!.price)}/1st yr</p>
                        </>
                      ) : (
                        <>
                          {original && period > 1 && (
                            <p className="text-xs line-through text-muted-foreground">{formatPrice(original)}/yr</p>
                          )}
                          <p className={`text-sm font-bold ${original && period > 1 ? "text-green-500" : "text-foreground"}`}>
                            {formatPrice(price)}/yr
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Contact for price</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to search →
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mini-Cart Slide-over */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setCartOpen(false)}
          />
          <div className="w-full max-w-sm bg-background border-l border-border flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <ShoppingCart size={16} className="text-primary" />
                <h3 className="font-semibold text-foreground">Cart ({cart.length})</h3>
              </div>
              <button onClick={() => setCartOpen(false)} className="text-muted-foreground hover:text-foreground">
                <XIcon size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map(item => (
                <div key={item.domain} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-sm text-foreground truncate">{item.domain}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-muted-foreground">{item.period} yr{item.period > 1 ? "s" : ""}</span>
                        {item.originalPrice && (
                          <span className="text-xs line-through text-muted-foreground">
                            {formatPrice(item.originalPrice)}
                          </span>
                        )}
                        <span className="text-xs font-bold text-foreground">{formatPrice(item.price)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.domain)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Hosting Upsell */}
              <div
                className="rounded-xl p-4 text-white"
                style={{ background: BRAND }}
              >
                <div className="flex items-start gap-3">
                  <Server size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Complete your website</p>
                    <p className="text-xs opacity-85 mt-0.5 leading-relaxed">
                      Add Premium Hosting for <strong>60% OFF</strong> and get everything you need to go live today.
                    </p>
                    <button
                      onClick={() => { setCartOpen(false); setLocation("/client/hosting"); }}
                      className="mt-2 text-xs font-semibold flex items-center gap-1 opacity-90 hover:opacity-100"
                    >
                      Add Hosting <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border space-y-2">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-foreground">
                  {formatPrice(cart.reduce((s, c) => s + c.price, 0))}
                </span>
              </div>
              <Button
                className="w-full h-11 gap-2 font-semibold"
                style={{ background: BRAND, border: "none" }}
                onClick={proceedToCheckout}
              >
                Proceed to Checkout <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
