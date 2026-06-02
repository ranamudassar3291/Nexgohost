import { useState, useRef } from "react";
import {
  Search, Check, X, Loader2, Globe, ShoppingCart, AlertCircle,
  Tag, ChevronRight, Trash2, Server, X as XIcon,
  ArrowRightLeft, BadgeInfo, Copy, CheckCheck, List, Users, Plus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useCurrency } from "@/context/CurrencyProvider";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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
  extension: string; tld: string;
  registerPrice: number; register2YearPrice: number | null; register3YearPrice: number | null;
  renewPrice: number; isFreeWithHosting: boolean; sortOrder: number; showInSuggestions: boolean;
}
interface SearchResult {
  domain: string; available: boolean | null;
  status: "available" | "taken" | "unknown";
  registerPrice: number | null; register2YearPrice: number | null; register3YearPrice: number | null;
  renewPrice: number | null; isFreeWithHosting: boolean; extension: string; checkedVia: string;
}
const DOMAIN_CART_KEY = "noehost_domain_cart_v1";

interface CartItem {
  domain: string; period: number; price: number; originalPrice: number | null;
  isFreeWithHosting: boolean; action: "register" | "transfer";
}

type Period = 1 | 2 | 3;
type Mode = "single" | "bulk" | "bulk-transfer";

const BRAND = "linear-gradient(135deg, #6B46C1 0%, #7C5DE2 60%, #8B5CF6 100%)";
const PK_2YEAR_PRICE = 4000;

function isPk(domain: string) {
  return /\.(pk|com\.pk|net\.pk|org\.pk)$/i.test(domain);
}

function getPrice(
  r: Pick<SearchResult | TldInfo, "registerPrice" | "register2YearPrice" | "register3YearPrice">,
  domain?: string,
  period: Period = 1
): { price: number | null; original: number | null; period: Period } {
  if (domain && isPk(domain)) return { price: PK_2YEAR_PRICE, original: null, period: 2 };
  if (period === 2 && r.register2YearPrice) return { price: r.register2YearPrice, original: r.registerPrice, period: 2 };
  if (period === 3 && r.register3YearPrice) return { price: r.register3YearPrice, original: r.registerPrice, period: 3 };
  return { price: r.registerPrice, original: null, period: 1 };
}

export default function DomainSearch() {
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("single");
  const [bulkInput, setBulkInput] = useState("");
  const [bulkResults, setBulkResults] = useState<SearchResult[]>([]);
  const [bulkSearching, setBulkSearching] = useState(false);
  const [bulkXferInput, setBulkXferInput] = useState("");
  const [bulkXferResults, setBulkXferResults] = useState<SearchResult[]>([]);
  const [bulkXferSearching, setBulkXferSearching] = useState(false);
  const [whoisOpen, setWhoisOpen] = useState(false);
  const [whoisDomain, setWhoisDomain] = useState<SearchResult | null>(null);
  const [whoisLoading, setWhoisLoading] = useState(false);
  const [whoisData, setWhoisData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

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
  const featuredTlds = tlds.filter(t => t.showInSuggestions).slice(0, 12);
  const tldMap = Object.fromEntries(tlds.map(t => [t.tld.startsWith(".") ? t.tld : `.${t.tld}`, t]));

  async function doSearch(baseName: string, tldList?: string[]) {
    const data = await apiFetch("/api/domain-search", {
      method: "POST",
      body: JSON.stringify({ domain: baseName, tlds: tldList }),
    });
    return Array.isArray(data.results) ? (data.results as SearchResult[]) : [];
  }

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const raw = query.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!raw) return;
    const base = raw.includes(".") ? raw.split(".")[0] : raw;
    setSearchTerm(base); setSearching(true); setError(null); setResults([]);
    try { setResults(await doSearch(base)); }
    catch { setError("Search failed. Please try again."); }
    finally { setSearching(false); }
  }

  async function handleBulkSearch() {
    const lines = bulkInput.split("\n").map(l => l.trim().toLowerCase()).filter(Boolean);
    if (!lines.length) return;
    setBulkSearching(true); setBulkResults([]);
    const all: SearchResult[] = [];
    for (const line of lines) {
      try {
        const base = line.includes(".") ? line.split(".")[0] : line;
        const tld = line.includes(".") ? line.slice(line.indexOf(".") + 1) : null;
        all.push(...await doSearch(base, tld ? [tld] : undefined));
      } catch {}
    }
    setBulkResults(all); setBulkSearching(false);
  }

  async function handleBulkXfer() {
    const lines = bulkXferInput.split("\n").map(l => l.trim().toLowerCase()).filter(Boolean);
    if (!lines.length) return;
    setBulkXferSearching(true); setBulkXferResults([]);
    const all: SearchResult[] = [];
    for (const line of lines) {
      try {
        const base = line.includes(".") ? line.split(".")[0] : line;
        const tld = line.includes(".") ? line.slice(line.indexOf(".") + 1) : null;
        all.push(...await doSearch(base, tld ? [tld] : undefined));
      } catch {}
    }
    setBulkXferResults(all); setBulkXferSearching(false);
  }

  async function openWhois(r: SearchResult) {
    setWhoisDomain(r); setWhoisData(null); setWhoisOpen(true); setWhoisLoading(true);
    try {
      const tld = r.extension.replace(/^\./, "");
      const ov: Record<string, string> = {
        com: "https://rdap.verisign.com/com/v1/",
        net: "https://rdap.verisign.com/net/v1/",
        org: "https://rdap.publicinterestregistry.org/rdap/",
        io: "https://rdap.nic.io/",
        co: "https://rdap.nic.co/",
        pk: "https://rdap.pknic.net.pk/",
        uk: "https://rdap.nominet.uk/uk/",
        de: "https://rdap.denic.de/",
      };
      const base = ov[tld];
      const url = base ? `${base}domain/${r.domain}` : `https://rdap.org/domain/${r.domain}`;
      const resp = await fetch(url, {
        headers: { Accept: "application/rdap+json, application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        const json = await resp.json();
        const fn = (e: any) => e?.vcardArray?.[1]?.find((v: any) => v[0] === "fn")?.[3];
        const reg = json.entities?.find((e: any) => e.roles?.includes("registrant"));
        const rar = json.entities?.find((e: any) => e.roles?.includes("registrar"));
        const exp = json.events?.find((e: any) => e.eventAction === "expiration")?.eventDate;
        const cre = json.events?.find((e: any) => e.eventAction === "registration")?.eventDate;
        const ns = (json.nameservers || []).map((n: any) => n.ldhName || n.unicodeName).filter(Boolean);
        setWhoisData({
          domain: json.ldhName || r.domain,
          status: (json.status || []).join(", ") || "—",
          registrantName: fn(reg) || reg?.handle || "Protected / Not Available",
          registrar: fn(rar) || rar?.handle || "Not available",
          expiryDate: exp ? new Date(exp).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Unknown",
          createdDate: cre ? new Date(cre).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Unknown",
          nameservers: ns.length ? ns : ["Not available"],
        });
      } else {
        setWhoisData({ error: "WHOIS data not available for this domain." });
      }
    } catch {
      setWhoisData({ error: "Could not fetch WHOIS. Use the ICANN Lookup link below." });
    } finally {
      setWhoisLoading(false);
    }
  }

  function addToCart(r: SearchResult, action: "register" | "transfer" = "register") {
    const { price, period: p, original } = getPrice(r, r.domain, isPk(r.domain) ? 2 : period);
    if (!price) return;
    const item: CartItem = {
      domain: r.domain,
      period: p,
      price,
      originalPrice: original,
      isFreeWithHosting: r.isFreeWithHosting,
      action,
    };
    setCart(prev => {
      const already = prev.find(c => c.domain === r.domain);
      const next = already ? prev : [...prev, item];
      localStorage.setItem(DOMAIN_CART_KEY, JSON.stringify(next));
      return next;
    });
    setCartOpen(true);
    toast({ title: "Added to cart!", description: `${r.domain} has been added to your cart.` });
  }

  function goTransfer(domain: string) {
    const token = localStorage.getItem("token") || localStorage.getItem("noehost_token");
    if (!token) {
      const returnPath = `/dashboard/domains/transfer?domain=${encodeURIComponent(domain)}`;
      setLocation(`/login?redirect=${encodeURIComponent(returnPath)}`);
      return;
    }
    setLocation(`/dashboard/domains/transfer?domain=${encodeURIComponent(domain)}`);
  }

  function copyWhois() {
    navigator.clipboard.writeText(JSON.stringify(whoisData, null, 2)).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  const avail = results.filter(r => r.status === "available");
  const taken = results.filter(r => r.status === "taken");

  function Tab({ m, icon, label }: { m: Mode; icon: React.ReactNode; label: string }) {
    return (
      <button onClick={() => setMode(m)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${mode === m ? "text-white border-transparent" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
        style={mode === m ? { background: BRAND } : {}}>
        {icon} {label}
      </button>
    );
  }

  function Row({ r, xfer = false }: { r: SearchResult; xfer?: boolean }) {
    const pk = isPk(r.domain);
    const { price, period: p } = getPrice(r, r.domain, pk ? 2 : period);
    const ok = r.status === "available";
    const tak = r.status === "taken";
    const inCart = cart.some(c => c.domain === r.domain);
    const tldData = tldMap[r.extension.startsWith(".") ? r.extension : `.${r.extension}`];
    return (
      <div className={`flex items-center justify-between rounded-2xl border px-5 py-4 transition-all ${ok ? "bg-green-500/5 border-green-500/25 hover:border-green-500/40" : tak ? "bg-card border-border opacity-80" : "bg-card border-border"}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ok ? "bg-green-500/15 text-green-500" : tak ? "bg-orange-500/10 text-orange-400" : "bg-muted text-muted-foreground"}`}>
            {ok ? <Check size={15} /> : tak ? (xfer ? <ArrowRightLeft size={14} /> : <X size={15} />) : <Globe size={15} />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm truncate font-mono">{r.domain}</p>
            {ok && price && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {pk ? `PKR ${PK_2YEAR_PRICE.toLocaleString()} / 2 yrs` : `${formatPrice(price)} / ${p} yr${p > 1 ? "s" : ""}`}
                {tldData?.isFreeWithHosting && <span className="ml-2 text-purple-400 font-medium">· FREE w/ Hosting</span>}
              </p>
            )}
            {tak && <p className="text-xs text-muted-foreground mt-0.5">{xfer ? "Registered — can transfer" : "Already registered"}</p>}
            {r.status === "unknown" && <p className="text-xs text-muted-foreground mt-0.5">Status unknown</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {ok ? (
            <>
              <Badge className="bg-green-500/15 text-green-500 border-green-500/25 text-xs hidden sm:flex">Available</Badge>
              {inCart
                ? <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setLocation("/checkout/domains")}><ShoppingCart size={12} /> Checkout</Button>
                : <Button size="sm" className="gap-1.5 text-xs h-8" style={{ background: BRAND, border: "none" }} onClick={() => addToCart(r, xfer ? "transfer" : "register")}><Plus size={12} /> Register Now</Button>}
            </>
          ) : tak ? (
            <>
              <Badge variant="secondary" className="text-xs">{xfer ? "Transferable" : "Taken"}</Badge>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => openWhois(r)}><BadgeInfo size={12} /> WHOIS</Button>
              {xfer
                ? (inCart
                    ? <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setLocation("/checkout/domains")}><ShoppingCart size={12} /> Checkout</Button>
                    : <Button size="sm" className="gap-1.5 text-xs h-8" style={{ background: BRAND, border: "none" }} onClick={() => addToCart(r, "transfer")}><ArrowRightLeft size={12} /> Transfer Now</Button>)
                : <Button size="sm" className="gap-1.5 text-xs h-8" style={{ background: BRAND, border: "none" }} onClick={() => goTransfer(r.domain)}><ArrowRightLeft size={12} /> Transfer</Button>}
            </>
          ) : (
            <a href={`https://lookup.icann.org/en/lookup?name=${encodeURIComponent(r.domain)}`} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 text-muted-foreground"><Globe size={12} /> Check</Button>
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="text-center space-y-2 pt-2">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: BRAND }}>
          <Globe size={26} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Find Your Perfect Domain</h1>
        <p className="text-muted-foreground text-sm">Instant availability · Live WHOIS · Competitive pricing</p>
      </div>

      {/* Mode Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Tab m="single" icon={<Search size={14} />} label="Domain Search" />
        <Tab m="bulk" icon={<List size={14} />} label="Bulk Search" />
        <Tab m="bulk-transfer" icon={<ArrowRightLeft size={14} />} label="Bulk Transfer" />
        {cart.length > 0 && (
          <button onClick={() => setLocation("/checkout/domains")}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-card border border-border hover:border-primary/40 transition-all">
            <ShoppingCart size={14} /> Checkout
            <span className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ background: BRAND }}>{cart.length}</span>
          </button>
        )}
      </div>

      {/* ── SINGLE SEARCH ── */}
      {mode === "single" && (
        <div className="space-y-5">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="mybusiness.com or just 'mybusiness'"
                className="pl-10 h-12 text-base bg-card border-border focus-visible:ring-0 focus-visible:border-border"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={searching || !query.trim()} className="h-12 px-7 gap-2 text-sm font-semibold" style={{ background: BRAND, border: "none" }}>
              {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Search
            </Button>
          </form>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Period:</span>
            {([1, 2, 3] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${period === p ? "text-white border-transparent" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
                style={period === p ? { background: BRAND } : {}}>
                {p} yr{p > 1 ? "s" : ""}
                {p === 3 && <span className={`ml-1 text-[10px] font-bold ${period === 3 ? "text-yellow-300" : "text-primary"}`}>DEAL</span>}
              </button>
            ))}
            {results.some(r => isPk(r.domain)) && (
              <span className="text-[11px] text-amber-500 font-medium ml-1">· .pk domains are 2-year only</span>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {/* 2-column Ionos-style layout */}
          {(results.length > 0 || searching) && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* LEFT — results */}
              <div className="lg:col-span-3 space-y-3">
                {searching ? (
                  <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
                    <Loader2 size={20} className="animate-spin" />
                    <span className="text-sm">Checking via RDAP &amp; DNS…</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground pb-1">
                      Results for <span className="font-semibold text-foreground">{searchTerm}</span>
                      <span className="ml-2 text-xs opacity-60">· {results.length} extensions</span>
                    </p>
                    {results.map(r => <Row key={r.domain} r={r} />)}
                  </>
                )}
              </div>

              {/* RIGHT — side panel */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <h3 className="font-semibold text-foreground text-sm">Quick Add</h3>
                  <div className="space-y-2">
                    {["com", "net", "org", "io", "pk"].map(ext => {
                      const r = results.find(r => r.domain === `${searchTerm}.${ext}`);
                      if (!r) return null;
                      const ok = r.status === "available";
                      return (
                        <div key={ext} className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${ok ? "border-green-500/20 bg-green-500/5" : "border-border bg-muted/20"}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${ok ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                            <span className="font-mono text-xs font-medium truncate">{r.domain}</span>
                          </div>
                          {ok
                            ? <button onClick={() => addToCart(r)} className="text-[10px] font-bold text-white px-2.5 py-1 rounded-lg shrink-0 ml-2" style={{ background: BRAND }}>Register</button>
                            : <span className="text-[10px] text-muted-foreground shrink-0 ml-2">Taken</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <h3 className="font-semibold text-foreground text-sm">Summary</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-green-500/10 rounded-xl px-3 py-3 text-center">
                      <p className="text-green-500 font-bold text-2xl">{avail.length}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">Available</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl px-3 py-3 text-center">
                      <p className="text-foreground font-bold text-2xl">{taken.length}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">Taken</p>
                    </div>
                  </div>
                  {cart.length > 0 && (
                    <Button className="w-full h-9 text-xs gap-2" style={{ background: BRAND, border: "none" }} onClick={() => setLocation("/checkout/domains")}>
                      <ShoppingCart size={13} /> Checkout ({cart.length}) <ChevronRight size={12} />
                    </Button>
                  )}
                </div>

                {taken.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
                    <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                      <ArrowRightLeft size={14} className="text-primary" /> Own a taken domain?
                    </h3>
                    <p className="text-xs text-muted-foreground">Transfer it to Noehost for better management.</p>
                    <Button size="sm" variant="outline" className="w-full gap-2 text-xs" onClick={() => setMode("bulk-transfer")}>
                      Start Domain Transfer →
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Popular TLD grid (pre-search) */}
          {!results.length && !searching && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Tag size={14} className="text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Popular Extensions — Click to search</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {featuredTlds.map(t => {
                  const ext = t.tld || (t.extension.startsWith(".") ? t.extension : `.${t.extension}`);
                  const pk = /^\.pk$|^\.com\.pk$/.test(ext);
                  const displayPrice = pk ? PK_2YEAR_PRICE : (t.registerPrice ?? null);
                  return (
                    <button key={ext}
                      onClick={() => { setQuery("mybusiness" + ext); setTimeout(() => handleSearch(), 0); }}
                      className="group text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:bg-primary/5 transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-base font-bold text-foreground">{ext}</span>
                        {t.isFreeWithHosting && <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/20 text-[9px] px-1 py-0">FREE</Badge>}
                      </div>
                      {displayPrice
                        ? <p className="text-sm font-bold text-foreground">
                            {pk ? `PKR ${PK_2YEAR_PRICE.toLocaleString()}` : formatPrice(displayPrice)}
                            <span className="text-xs font-normal text-muted-foreground ml-1">/{pk ? "2 yrs" : "yr"}</span>
                          </p>
                        : <p className="text-xs text-muted-foreground">Contact for price</p>}
                      <p className="text-[10px] text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to search →</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BULK SEARCH ── */}
      {mode === "bulk" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="font-bold text-foreground text-base flex items-center gap-2"><List size={16} className="text-primary" /> Bulk Domain Search</h2>
              <p className="text-xs text-muted-foreground mt-1">Enter one domain per line — e.g. mybusiness.com, mystore.pk</p>
            </div>
            <Textarea value={bulkInput} onChange={e => setBulkInput(e.target.value)}
              placeholder={"mybusiness.com\nmystore.pk\nmysite.net\nmyapp.io"}
              className="min-h-[160px] font-mono text-sm resize-none focus-visible:ring-0 focus-visible:border-border" rows={8} />
            <Button disabled={bulkSearching || !bulkInput.trim()} onClick={handleBulkSearch} className="gap-2" style={{ background: BRAND, border: "none" }}>
              {bulkSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Check Availability
            </Button>
          </div>
          {bulkSearching && (
            <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
              <Loader2 size={18} className="animate-spin" /><span className="text-sm">Checking domains…</span>
            </div>
          )}
          {bulkResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{bulkResults.length} domains checked</p>
              {bulkResults.map(r => <Row key={r.domain} r={r} />)}
              {cart.length > 0 && (
                <Button className="w-full gap-2" style={{ background: BRAND, border: "none" }} onClick={() => setLocation("/checkout/domains")}>
                  <ShoppingCart size={15} /> Proceed to Checkout ({cart.length}) <ChevronRight size={14} />
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── BULK TRANSFER ── */}
      {mode === "bulk-transfer" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="font-bold text-foreground text-base flex items-center gap-2"><ArrowRightLeft size={16} className="text-primary" /> Bulk Domain Transfer</h2>
              <p className="text-xs text-muted-foreground mt-1">Enter domains you want to transfer to Noehost, one per line</p>
            </div>
            <Textarea value={bulkXferInput} onChange={e => setBulkXferInput(e.target.value)}
              placeholder={"mybusiness.com\nmystore.pk\nmysite.net"}
              className="min-h-[160px] font-mono text-sm resize-none focus-visible:ring-0 focus-visible:border-border" rows={8} />
            <Button disabled={bulkXferSearching || !bulkXferInput.trim()} onClick={handleBulkXfer} className="gap-2" style={{ background: BRAND, border: "none" }}>
              {bulkXferSearching ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />} Check &amp; Transfer
            </Button>
          </div>
          {bulkXferSearching && (
            <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
              <Loader2 size={18} className="animate-spin" /><span className="text-sm">Checking domains…</span>
            </div>
          )}
          {bulkXferResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{bulkXferResults.length} domains checked</p>
              {bulkXferResults.map(r => <Row key={r.domain} r={r} xfer />)}
            </div>
          )}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-2">
            <p className="font-semibold text-foreground text-sm flex items-center gap-2"><Users size={14} className="text-primary" /> How domain transfer works</p>
            <ul className="text-muted-foreground text-xs space-y-1 list-disc pl-4">
              <li>Unlock your domain at your current registrar</li>
              <li>Get your EPP / Authorization code</li>
              <li>Click Transfer and enter the EPP code</li>
              <li>Confirm the transfer email from your registrar</li>
              <li>Transfer completes in 5–7 business days</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── WHOIS DIALOG ── */}
      <Dialog open={whoisOpen} onOpenChange={setWhoisOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeInfo size={16} className="text-primary" /> WHOIS — {whoisDomain?.domain}
            </DialogTitle>
          </DialogHeader>
          {whoisLoading && (
            <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
              <Loader2 size={18} className="animate-spin" /><span className="text-sm">Fetching live WHOIS from RDAP…</span>
            </div>
          )}
          {!whoisLoading && whoisData && (
            <div className="space-y-4">
              {whoisData.error ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" /> {whoisData.error}
                  </div>
                  <a href={`https://lookup.icann.org/en/lookup?name=${encodeURIComponent(whoisDomain?.domain || "")}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2 text-xs w-full"><Globe size={12} /> Check on ICANN Official Lookup</Button>
                  </a>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                    {[
                      { label: "Domain", value: whoisData.domain },
                      { label: "Status", value: whoisData.status },
                      { label: "Registrant", value: whoisData.registrantName },
                      { label: "Registrar", value: whoisData.registrar },
                      { label: "Created", value: whoisData.createdDate },
                      { label: "Expires", value: whoisData.expiryDate },
                    ].map(row => (
                      <div key={row.label} className="grid grid-cols-5">
                        <div className="col-span-2 bg-muted/40 px-4 py-2.5 text-muted-foreground text-xs font-medium">{row.label}</div>
                        <div className="col-span-3 px-4 py-2.5 font-mono text-xs text-foreground break-all">{row.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-muted-foreground text-xs mb-2 font-medium">Nameservers</p>
                    <div className="flex flex-wrap gap-2">
                      {whoisData.nameservers.map((ns: string) => <Badge key={ns} variant="secondary" className="font-mono text-[11px]">{ns}</Badge>)}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={copyWhois}>
                      {copied ? <CheckCheck size={12} /> : <Copy size={12} />}{copied ? " Copied!" : " Copy Data"}
                    </Button>
                    <a href={`https://lookup.icann.org/en/lookup?name=${encodeURIComponent(whoisDomain?.domain || "")}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs"><Globe size={12} /> ICANN Official</Button>
                    </a>
                    {whoisDomain && (
                      <Button size="sm" className="gap-1.5 text-xs ml-auto" style={{ background: BRAND, border: "none" }}
                        onClick={() => { setWhoisOpen(false); goTransfer(whoisDomain.domain); }}>
                        <ArrowRightLeft size={12} /> Transfer This Domain
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MINI CART DRAWER ── */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="w-full max-w-sm bg-background border-l border-border flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <ShoppingCart size={16} className="text-primary" />
                <h3 className="font-semibold text-foreground">Cart ({cart.length})</h3>
              </div>
              <button onClick={() => setCartOpen(false)} className="text-muted-foreground hover:text-foreground"><XIcon size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map(item => (
                <div key={item.domain} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-sm text-foreground truncate">{item.domain}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-muted-foreground">{item.period} yr{item.period > 1 ? "s" : ""}</span>
                        {item.originalPrice && <span className="text-xs line-through text-muted-foreground">{formatPrice(item.originalPrice)}</span>}
                        <span className="text-xs font-bold text-foreground">
                          {isPk(item.domain) ? `PKR ${item.price.toLocaleString()}` : formatPrice(item.price)}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setCart(prev => prev.filter(c => c.domain !== item.domain))}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="rounded-xl p-4 text-white" style={{ background: BRAND }}>
                <div className="flex items-start gap-3">
                  <Server size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Complete your website</p>
                    <p className="text-xs opacity-85 mt-0.5">Add Premium Hosting for <strong>60% OFF</strong> with your domain.</p>
                    <button onClick={() => { setCartOpen(false); setLocation("/dashboard/hosting"); }}
                      className="mt-2 text-xs font-semibold flex items-center gap-1 opacity-90 hover:opacity-100">
                      Add Hosting <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border space-y-2">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-foreground">{formatPrice(cart.reduce((s, c) => s + c.price, 0))}</span>
              </div>
              <Button className="w-full h-11 gap-2 font-semibold" style={{ background: BRAND, border: "none" }}
                onClick={() => {
                  if (!cart.length) return;
                  // Persist the full cart (all domains + action types) to localStorage
                  localStorage.setItem(DOMAIN_CART_KEY, JSON.stringify(cart));
                  setCartOpen(false);
                  // Route to dedicated domain checkout — no login required upfront
                  setLocation("/checkout/domains");
                }}>
                Checkout Now <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
