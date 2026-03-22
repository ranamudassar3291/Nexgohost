import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  useSearchDomainAvailability,
  useRegisterDomain,
  type DomainTldResult,
  type DomainRegisterResponse,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Globe, Search, ShoppingCart, CheckCircle2, XCircle, AlertCircle,
  Loader2, Trash2, ExternalLink, RefreshCw, ChevronRight, X, BadgeCheck, RotateCcw,
  Server, Plus, Minus, Save, Key, Copy, CheckCheck,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";

interface MyDomain {
  id: string; name: string; tld: string; status: string; registrationDate: string | null;
  expiryDate: string | null; autoRenew: boolean; nameservers: string[] | null;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

const TLD_ICONS: Record<string, string> = {
  ".com": "🌐", ".net": "🔗", ".org": "🏛️", ".co": "🏢", ".io": "💻", ".uk": "🇬🇧",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  expired: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  transferred: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

interface CartItem {
  name: string;
  tld: string;
  price: number;
  period: number;
}

type Tab = "my-domains" | "order";

export default function ClientDomains() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("my-domains");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [successResult, setSuccessResult] = useState<DomainRegisterResponse | null>(null);
  const [orderingDomain, setOrderingDomain] = useState<string | null>(null);
  const [dnsModal, setDnsModal] = useState<MyDomain | null>(null);
  const [eppModal, setEppModal] = useState<MyDomain | null>(null);
  const [eppCode, setEppCode] = useState<string | null>(null);
  const [eppLoading, setEppLoading] = useState(false);
  const [eppCopied, setEppCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const { data: myDomains = [], isLoading: domainsLoading } = useQuery<MyDomain[]>({
    queryKey: ["my-domains"],
    queryFn: () => apiFetch("/api/domains"),
  });
  const { data: searchData, isLoading: searching, error: searchError } = useSearchDomainAvailability(searchQuery);
  const registerMutation = useRegisterDomain();
  const { toast } = useToast();

  const openEppModal = async (domain: MyDomain) => {
    setEppModal(domain);
    setEppCode(null);
    setEppCopied(false);
    setEppLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/domains/${domain.id}/epp`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setEppCode(data.authCode);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setEppModal(null);
    } finally {
      setEppLoading(false);
    }
  };

  const copyEppCode = async () => {
    if (!eppCode) return;
    await navigator.clipboard.writeText(eppCode);
    setEppCopied(true);
    setTimeout(() => setEppCopied(false), 2500);
  };

  const toggleAutoRenew = async (domainId: string, current: boolean) => {
    try {
      await apiFetch(`/api/domains/${domainId}/auto-renew`, { method: "PUT", body: JSON.stringify({ autoRenew: !current }) });
      queryClient.invalidateQueries({ queryKey: ["my-domains"] });
      toast({ title: `Auto-renew ${!current ? "enabled" : "disabled"}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSearch = () => {
    const val = searchInput.trim().toLowerCase().split(".")[0];
    if (!val) return;
    setSearchQuery(val);
    setSuccessResult(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const addToCart = (item: DomainTldResult) => {
    const key = `${searchData!.name}${item.tld}`;
    if (cart.some(c => `${c.name}${c.tld}` === key)) {
      toast({ title: "Already in cart", description: key });
      return;
    }
    setCart(prev => [...prev, { name: searchData!.name, tld: item.tld, price: item.registrationPrice, period: 1 }]);
    setShowCart(true);
    toast({ title: "Added to cart", description: key });
  };

  const removeFromCart = (idx: number) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePeriod = (idx: number, period: number) => {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, period } : item));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.period, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    const errors: string[] = [];
    let lastResult: any = null;

    for (const item of cart) {
      setOrderingDomain(`${item.name}${item.tld}`);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/checkout/domain", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            domain: item.name,
            tld: item.tld,
            amount: item.price * item.period,
            period: item.period,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to place order");
        lastResult = data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `Failed to register ${item.name}${item.tld}`;
        errors.push(msg);
      }
    }

    setOrderingDomain(null);

    if (errors.length > 0 && !lastResult) {
      toast({ title: "Order failed", description: errors[0], variant: "destructive" });
      return;
    }

    if (lastResult) {
      setSuccessResult({ domain: lastResult.order?.domain, invoiceNumber: lastResult.invoice?.invoiceNumber } as any);
      queryClient.invalidateQueries({ queryKey: ["my-domains"] });
      setCart([]);
      setShowCart(false);
      setSearchQuery(null);
      setSearchInput("");
      toast({ title: "Domain order placed!", description: `Order submitted for admin approval. Invoice: ${lastResult.invoice?.invoiceNumber}` });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Domains</h2>
          <p className="text-muted-foreground mt-1">Register and manage your domain names.</p>
        </div>
        <div className="flex items-center gap-3">
          {cart.length > 0 && (
            <button
              onClick={() => setShowCart(true)}
              className="relative flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-xl text-primary hover:bg-primary/20 transition-colors font-medium text-sm"
            >
              <ShoppingCart size={16} />
              Cart
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary rounded-full text-white text-xs flex items-center justify-center font-bold">
                {cart.length}
              </span>
            </button>
          )}
          <button
            onClick={() => { setActiveTab("order"); setTimeout(() => inputRef.current?.focus(), 100); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium text-sm shadow-lg shadow-primary/20 transition-colors"
          >
            <Globe size={16} /> Order New Domain
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-secondary/50 border border-border rounded-xl p-1 w-fit">
        {(["my-domains", "order"] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab === "my-domains" ? `My Domains (${myDomains.length})` : "Order New Domain"}
          </button>
        ))}
      </div>

      {activeTab === "order" && (
        <div className="space-y-6">
          {successResult ? (
            <SuccessBanner result={successResult} onOrderMore={() => { setSuccessResult(null); setActiveTab("my-domains"); }} onPayInvoice={() => navigate("/client/invoices")} />
          ) : (
            <>
              <div className="bg-card border border-border rounded-2xl p-6 shadow-lg shadow-black/5">
                <h3 className="text-lg font-display font-bold mb-4">Search Domain Availability</h3>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      ref={inputRef}
                      className="pl-10 bg-background text-lg h-12 font-mono border-border focus:border-primary"
                      placeholder="yourdomain"
                      value={searchInput}
                      onChange={e => setSearchInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <Button
                    onClick={handleSearch}
                    disabled={!searchInput.trim() || searching}
                    className="h-12 px-6 bg-primary hover:bg-primary/90 text-white gap-2 font-semibold"
                  >
                    {searching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                    {searching ? "Checking..." : "Search"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Availability checked via RDAP — the official domain registration data protocol.
                </p>
              </div>

              {searchError && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                  <AlertCircle size={20} />
                  <div>
                    <p className="font-medium">Search failed</p>
                    <p className="text-sm">{searchError.message || "Please check your domain name and try again."}</p>
                  </div>
                </div>
              )}

              {searchData && !searching && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-lg">
                      Results for <span className="text-primary font-mono">{searchData.name}</span>
                    </h3>
                    <p className="text-sm text-muted-foreground">{searchData.results.filter(r => r.available).length} of {searchData.results.length} TLDs available</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchData.results.map(result => (
                      <TldCard
                        key={result.tld}
                        name={searchData.name}
                        result={result}
                        inCart={cart.some(c => c.name === searchData.name && c.tld === result.tld)}
                        onAddToCart={() => addToCart(result)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {!searchData && !searching && !searchError && (
                <div className="bg-card border border-border/50 border-dashed rounded-3xl p-16 text-center">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20">
                    <Globe className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-foreground">Find Your Perfect Domain</h3>
                  <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                    Type a domain name above to check availability across .com, .net, .org, .co, .io, .uk and more.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-6">
                    {[".com", ".net", ".org", ".co", ".io", ".uk"].map(tld => (
                      <span key={tld} className="px-3 py-1 bg-secondary border border-border rounded-lg text-sm font-mono text-muted-foreground">{tld}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "my-domains" && (
        <div className="space-y-4">
          {domainsLoading ? (
            <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : myDomains.length === 0 ? (
            <div className="bg-card border border-border border-dashed rounded-3xl p-12 text-center">
              <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="text-xl font-bold text-foreground">No domains yet</h3>
              <p className="text-muted-foreground mt-2">Register your first domain to get started.</p>
              <Button onClick={() => setActiveTab("order")} className="mt-6 bg-primary text-white gap-2">
                <Globe size={16} /> Order New Domain
              </Button>
            </div>
          ) : (
            myDomains.map(domain => {
              const expiryDate = domain.expiryDate ? new Date(domain.expiryDate) : null;
              const daysLeft = expiryDate ? Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
              const isExpiringSoon = daysLeft !== null && daysLeft < 30;

              return (
                <div key={domain.id} className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-all group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center text-2xl">
                        {TLD_ICONS[domain.tld] || "🌐"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl font-bold text-foreground font-mono">{domain.name}{domain.tld}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${statusColors[domain.status]}`}>{domain.status}</span>
                          {isExpiringSoon && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              <AlertCircle className="w-3 h-3" /> Expiring soon
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 font-mono">{domain.nameservers?.[0] || "ns1.nexgohost.com"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="outline" size="sm" className="gap-1 text-xs h-8">
                        <RefreshCw size={12} /> Renew
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={() => setDnsModal(domain)}>
                        <Server size={12} /> Nameservers
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={() => openEppModal(domain)} title="Get EPP / Auth Code for domain transfer">
                        <Key size={12} /> Auth Code
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border/50">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Registered</p>
                      <p className="text-sm font-medium">
                        {domain.registrationDate ? format(new Date(domain.registrationDate), "MMM d, yyyy") : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Expires</p>
                      <p className={`text-sm font-medium ${isExpiringSoon ? "text-orange-400" : ""}`}>
                        {expiryDate ? format(expiryDate, "MMM d, yyyy") : "N/A"}
                        {daysLeft !== null && (
                          <span className="text-xs ml-1 text-muted-foreground">({daysLeft}d)</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Auto Renew</p>
                      <button
                        onClick={() => toggleAutoRenew(domain.id, domain.autoRenew)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer hover:opacity-80 ${
                          domain.autoRenew ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}
                      >
                        <RotateCcw size={11} />
                        {domain.autoRenew ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Nameservers</p>
                      <p className="text-sm font-medium">{domain.nameservers?.[0] || "ns1.nexgohost.com"}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {showCart && (
        <CartDrawer
          cart={cart}
          onClose={() => setShowCart(false)}
          onRemove={removeFromCart}
          onUpdatePeriod={updatePeriod}
          onCheckout={handleCheckout}
          isLoading={registerMutation.isPending}
          orderingDomain={orderingDomain}
          total={cartTotal}
        />
      )}

      {dnsModal && (
        <DnsModal
          domain={dnsModal}
          onClose={() => setDnsModal(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["my-domains"] });
            setDnsModal(null);
          }}
        />
      )}

      {eppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Key size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">EPP / Auth Code</h3>
                  <p className="text-xs text-muted-foreground font-mono">{eppModal.name}{eppModal.tld}</p>
                </div>
              </div>
              <button onClick={() => { setEppModal(null); setEppCode(null); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Use this authorization code to initiate a domain transfer to another registrar. Keep it confidential and provide it only when requested by your new registrar.
            </p>

            <div className="bg-secondary rounded-xl p-4 mb-4">
              {eppLoading ? (
                <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Fetching auth code…</span>
                </div>
              ) : eppCode ? (
                <div className="flex items-center justify-between gap-3">
                  <code className="font-mono text-base font-bold text-primary tracking-wider break-all">{eppCode}</code>
                  <button
                    onClick={copyEppCode}
                    className="shrink-0 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                    title="Copy to clipboard"
                  >
                    {eppCopied ? <CheckCheck size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Unable to retrieve auth code.</p>
              )}
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>This code is valid for domain transfer only. Keep it private. Generate a new code if it becomes compromised.</span>
            </div>

            <Button className="w-full mt-4" variant="outline" onClick={() => { setEppModal(null); setEppCode(null); }}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TldCard({ name, result, inCart, onAddToCart }: {
  name: string;
  result: DomainTldResult;
  inCart: boolean;
  onAddToCart: () => void;
}) {
  const { formatPrice } = useCurrency();
  const fullDomain = `${name}${result.tld}`;

  return (
    <div className={`relative bg-card border rounded-2xl p-5 transition-all ${
      result.available
        ? inCart
          ? "border-primary/60 bg-primary/5 shadow-lg shadow-primary/10"
          : "border-border hover:border-primary/40"
        : "border-border/40 opacity-70"
    }`}>
      {result.rdapStatus === "unknown" && result.available && (
        <div className="absolute top-3 right-3">
          <span title="Availability unconfirmed — domain may still be available" className="text-yellow-400 cursor-help">
            <AlertCircle size={14} />
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{TLD_ICONS[result.tld] || "🌐"}</span>
        <div>
          <span className="font-mono font-bold text-foreground text-lg">{name}</span>
          <span className="font-mono font-bold text-primary text-lg">{result.tld}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {result.available ? (
          <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
            <CheckCircle2 size={15} /> Available
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-red-400 text-sm font-medium">
            <XCircle size={15} /> Unavailable
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-foreground">{formatPrice(result.registrationPrice)}</p>
          <p className="text-xs text-muted-foreground">/year · renews {formatPrice(result.renewalPrice)}/yr</p>
        </div>

        {result.available ? (
          inCart ? (
            <span className="flex items-center gap-1.5 text-primary text-sm font-medium">
              <BadgeCheck size={16} /> In Cart
            </span>
          ) : (
            <Button
              size="sm"
              onClick={onAddToCart}
              className="bg-primary hover:bg-primary/90 text-white gap-1.5 h-9"
            >
              <ShoppingCart size={14} /> Add
            </Button>
          )
        ) : (
          <Button size="sm" variant="ghost" disabled className="h-9 text-muted-foreground">
            Taken
          </Button>
        )}
      </div>

      {!result.available && result.rdapStatus !== "taken" && (
        <p className="text-xs text-muted-foreground mt-2">This domain name is registered</p>
      )}
    </div>
  );
}

function CartDrawer({ cart, onClose, onRemove, onUpdatePeriod, onCheckout, isLoading, orderingDomain, total }: {
  cart: CartItem[];
  onClose: () => void;
  onRemove: (idx: number) => void;
  onUpdatePeriod: (idx: number, period: number) => void;
  onCheckout: () => void;
  isLoading: boolean;
  orderingDomain: string | null;
  total: number;
}) {
  const { formatPrice } = useCurrency();
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-background border-l border-border flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <ShoppingCart size={20} className="text-primary" />
            <h3 className="font-display font-bold text-lg">Your Cart</h3>
            <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {cart.map((item, idx) => (
            <div key={idx} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono font-bold text-foreground">
                    <span>{item.name}</span><span className="text-primary">{item.tld}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatPrice(item.price)}/year × {item.period} year{item.period > 1 ? "s" : ""} = <span className="text-foreground font-semibold">{formatPrice(item.price * item.period)}</span>
                  </p>
                </div>
                <button onClick={() => onRemove(idx)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                  <Trash2 size={15} />
                </button>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Registration Period</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map(yr => (
                    <button
                      key={yr}
                      onClick={() => onUpdatePeriod(idx, yr)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        item.period === yr
                          ? "bg-primary border-primary text-white"
                          : "bg-background border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {yr}yr
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-5 space-y-4">
          <div className="space-y-2">
            {cart.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-muted-foreground font-mono">{item.name}{item.tld}</span>
                <span>{formatPrice(item.price * item.period)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-lg border-t border-border pt-2 mt-2">
              <span>Total</span>
              <span className="text-primary">{formatPrice(total)}</span>
            </div>
          </div>

          {orderingDomain && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
              <Loader2 className="animate-spin text-primary" size={16} />
              <span>Registering <span className="font-mono text-foreground">{orderingDomain}</span>…</span>
            </div>
          )}

          <Button
            onClick={onCheckout}
            disabled={isLoading || cart.length === 0}
            className="w-full bg-primary hover:bg-primary/90 text-white h-12 font-bold text-base gap-2 shadow-lg shadow-primary/20"
          >
            {isLoading ? (
              <><Loader2 className="animate-spin" size={18} /> Processing…</>
            ) : (
              <><ChevronRight size={18} /> Complete Order — {formatPrice(total)}</>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            An invoice will be generated. Domain activates after admin approval.
          </p>
        </div>
      </div>
    </div>
  );
}

function SuccessBanner({ result, onOrderMore, onPayInvoice }: { result: DomainRegisterResponse; onOrderMore: () => void; onPayInvoice: () => void }) {
  const { formatPrice } = useCurrency();
  return (
    <div className="bg-card border border-emerald-500/30 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/5 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-primary/5 pointer-events-none" />
      <div className="relative z-10 p-10 text-center">
        <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h3 className="text-2xl font-display font-bold text-foreground">Domain Registered!</h3>
        <p className="text-muted-foreground mt-2 text-lg">
          <span className="font-mono text-foreground font-bold">{result.domain.name}{result.domain.tld}</span> is now active.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-lg mx-auto">
          <div className="bg-background/60 border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Domain</p>
            <p className="font-mono font-bold text-sm">{result.domain.name}{result.domain.tld}</p>
          </div>
          <div className="bg-background/60 border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Invoice</p>
            <p className="font-bold text-sm">{result.invoice.invoiceNumber}</p>
          </div>
          <div className="bg-background/60 border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Amount Due</p>
            <p className="font-bold text-sm text-primary">{typeof result.invoice?.total === "number" ? formatPrice(result.invoice.total) : (result.invoice?.total || "—")}</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl max-w-lg mx-auto text-sm text-blue-300 flex items-start gap-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>
            Invoice <strong>{result.invoice.invoiceNumber}</strong> has been created and is due by{" "}
            {format(new Date(result.invoice.dueDate), "MMM d, yyyy")}. Visit the Invoices section to pay.
          </span>
        </div>

        <div className="mt-8 flex gap-4 justify-center">
          <Button onClick={onOrderMore} variant="outline" className="gap-2 border-border bg-card hover:bg-secondary">
            View My Domains
          </Button>
          <Button onClick={onPayInvoice} className="bg-primary hover:bg-primary/90 text-white gap-2">
            Pay Invoice <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function DnsModal({ domain, onClose, onSaved }: {
  domain: MyDomain;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const defaultNs = domain.nameservers?.length
    ? [...domain.nameservers, "", ""].slice(0, Math.max(domain.nameservers.length + 1, 4))
    : ["ns1.nexgohost.com", "ns2.nexgohost.com", "", ""];

  const [nameservers, setNameservers] = useState<string[]>(defaultNs);
  const [saving, setSaving] = useState(false);

  const update = (idx: number, val: string) => setNameservers(ns => ns.map((n, i) => i === idx ? val : n));
  const addRow = () => setNameservers(ns => [...ns, ""]);
  const removeRow = (idx: number) => setNameservers(ns => ns.filter((_, i) => i !== idx));

  const handleSave = async () => {
    const cleaned = nameservers.map(s => s.trim()).filter(Boolean);
    if (cleaned.length < 2) {
      toast({ title: "At least 2 nameservers required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/domains/${domain.id}/nameservers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nameservers: cleaned }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast({ title: "Nameservers updated", description: `${domain.name}${domain.tld} nameservers saved` });
      onSaved();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Server size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Nameservers</h3>
              <p className="text-xs text-muted-foreground font-mono">{domain.name}{domain.tld}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-muted-foreground">Update the nameservers for your domain. Changes may take up to 48 hours to propagate.</p>

          <div className="space-y-2">
            {nameservers.map((ns, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <span className="text-xs font-medium text-muted-foreground w-6 text-right shrink-0">{idx + 1}</span>
                <Input
                  value={ns}
                  onChange={e => update(idx, e.target.value)}
                  placeholder={`ns${idx + 1}.example.com`}
                  className="font-mono text-sm flex-1"
                />
                {idx >= 2 && (
                  <button onClick={() => removeRow(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Minus size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {nameservers.length < 6 && (
            <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
              <Plus size={13} /> Add nameserver
            </button>
          )}

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300 flex gap-2 mt-4">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-blue-400" />
            <span>DNS propagation can take up to 48 hours. During this time your domain may be temporarily unavailable.</span>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-border">
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90 gap-2">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Nameservers
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
