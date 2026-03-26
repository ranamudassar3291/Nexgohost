import { useState, useRef, useCallback, useEffect } from "react";
import { RenewalCartModal, type RenewalItem } from "./RenewalCartModal";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Globe, Search, ShoppingCart, CheckCircle2, XCircle, AlertCircle,
  Loader2, Trash2, RefreshCw, ChevronRight, X, BadgeCheck, RotateCcw,
  Server, Plus, Minus, Save, Key, Copy, CheckCheck, ArrowLeft, ClipboardList,
  ArrowRightLeft, ShieldCheck, Lock, Network, Settings, Receipt,
  Tag, Wallet, CreditCard, Smartphone, Landmark,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyProvider";

interface MyDomain {
  id: string; name: string; tld: string; status: string; registrationDate: string | null;
  expiryDate: string | null; autoRenew: boolean; nameservers: string[] | null;
  lockStatus: string | null;
  eppCode: string | null;
  lastLockChange: string | null;
  lockOverrideByAdmin: boolean;
  isIn60DayLock: boolean;
  registrationAgeDays: number;
  daysRemainingInLock: number;
}

interface TldResult {
  tld: string;
  available: boolean;
  rdapStatus?: string;
  registrationPrice: number;
  register2YearPrice: number | null;
  register3YearPrice: number | null;
  renewalPrice: number;
  renew2YearPrice: number | null;
  renew3YearPrice: number | null;
}

interface SearchResult {
  name: string;
  results: TldResult[];
}

interface CartItem {
  name: string;
  tld: string;
  prices: { 1: number; 2: number; 3: number };
  period: 1 | 2 | 3;
}

interface OrderSuccess {
  domain: string;
  invoiceNumber: string;
  amount: number;
  period: number;
  invoiceDueDate: string | null;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token") || "";
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error(`Server error (${res.status})`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

// Professional TLD badge color palette — registry-brand inspired
const TLD_COLORS: Record<string, { bg: string; text: string }> = {
  ".com":    { bg: "#1a73e8", text: "#fff" },
  ".net":    { bg: "#0f9d58", text: "#fff" },
  ".org":    { bg: "#8430d6", text: "#fff" },
  ".co":     { bg: "#e67c00", text: "#fff" },
  ".io":     { bg: "#1a1a2e", text: "#e0e0ff" },
  ".uk":     { bg: "#012169", text: "#fff" },
  ".pk":     { bg: "#01411c", text: "#fff" },
  ".us":     { bg: "#3c3b6e", text: "#fff" },
  ".de":     { bg: "#000000", text: "#fff" },
  ".in":     { bg: "#FF9933", text: "#fff" },
  ".ae":     { bg: "#00732f", text: "#fff" },
  ".biz":    { bg: "#b5451b", text: "#fff" },
  ".blog":   { bg: "#21759b", text: "#fff" },
  ".co.uk":  { bg: "#003087", text: "#fff" },
  ".com.pk": { bg: "#01411c", text: "#fff" },
  ".eu":     { bg: "#003399", text: "#ffcc00" },
  ".gkp.pk": { bg: "#01411c", text: "#fff" },
  ".info":   { bg: "#2aa0d4", text: "#fff" },
};

function TldIcon({ tld }: { tld: string }) {
  const color = TLD_COLORS[tld] ?? { bg: "#4b5563", text: "#fff" };
  const label = tld.startsWith(".") ? tld.slice(1).toUpperCase() : tld.toUpperCase();
  const fontSize = label.length > 4 ? "8px" : label.length > 3 ? "9px" : "10px";
  return (
    <div
      style={{ background: color.bg, color: color.text, fontSize }}
      className="w-11 h-11 rounded-xl flex items-center justify-center font-black tracking-tight shrink-0 select-none shadow-sm"
    >
      {label}
    </div>
  );
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  expired: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  transferred: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  suspended: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  cancelled: "bg-secondary text-muted-foreground border-border",
  pending_transfer: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  expired: "Expired",
  pending: "Pending",
  transferred: "Transferred",
  suspended: "Suspended",
  cancelled: "Cancelled",
  pending_transfer: "Pending Transfer",
};

function getPriceForPeriod(item: CartItem): number {
  return item.prices[item.period];
}

function getCartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + getPriceForPeriod(item), 0);
}

type Tab = "my-domains" | "order" | "transfers";
type OrderView = "search" | "review" | "success";

interface DomainTransfer {
  id: string; domainName: string; epp: string; status: string;
  validationMessage: string | null; price: string; createdAt: string;
}

export default function ClientDomains() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("my-domains");
  const [orderView, setOrderView] = useState<OrderView>("search");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [success, setSuccess] = useState<OrderSuccess | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderNameservers, setOrderNameservers] = useState<string[]>(["ns1.noehost.com", "ns2.noehost.com"]);
  const [dnsModal, setDnsModal] = useState<MyDomain | null>(null);
  const [eppModal, setEppModal] = useState<MyDomain | null>(null);
  const [eppCode, setEppCode] = useState<string | null>(null);
  const [eppError, setEppError] = useState<string | null>(null);
  const [eppLoading, setEppLoading] = useState(false);
  const [eppCopied, setEppCopied] = useState(false);
  const [manageDomainModal, setManageDomainModal] = useState<MyDomain | null>(null);
  const [renewLoading, setRenewLoading] = useState(false);
  const [renewModalItem, setRenewModalItem] = useState<RenewalItem | null>(null);
  const [lockLoading, setLockLoading] = useState<string | null>(null);
  const [lockOverrides, setLockOverrides] = useState<Record<string, string>>({});
  const [eppOverrides, setEppOverrides] = useState<Record<string, string | null>>({});
  const [eppCopiedId, setEppCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const { toast } = useToast();

  const { data: myDomains = [], isLoading: domainsLoading } = useQuery<MyDomain[]>({
    queryKey: ["my-domains"],
    queryFn: () => apiFetch("/api/domains"),
  });

  const { data: transfersData, isLoading: transfersLoading, refetch: refetchTransfers } = useQuery<{ transfers: DomainTransfer[] }>({
    queryKey: ["my-domain-transfers"],
    queryFn: () => apiFetch("/api/domains/transfers"),
    enabled: activeTab === "transfers",
  });
  const myTransfers = transfersData?.transfers ?? [];

  const handleCancelTransfer = async (id: string) => {
    if (!confirm("Cancel this domain transfer request?")) return;
    setCancellingId(id);
    try {
      await apiFetch(`/api/domains/transfers/${id}/cancel`, { method: "PUT" });
      toast({ title: "Transfer cancelled" });
      refetchTransfers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  const { data: searchData, isLoading: searching, error: searchError } = useQuery<SearchResult>({
    queryKey: ["domain-availability", searchQuery],
    queryFn: () => apiFetch(`/api/domains/availability?domain=${encodeURIComponent(searchQuery!)}`),
    enabled: !!searchQuery,
    retry: false,
    staleTime: 60_000,
  });

  const openEppModal = async (domain: MyDomain) => {
    setEppModal(domain);
    setEppCode(null);
    setEppError(null);
    setEppCopied(false);
    setEppLoading(true);
    try {
      const data = await apiFetch(`/api/domains/${domain.id}/epp`);
      setEppCode(data.eppCode || null);
    } catch (err: any) {
      setEppCode(null);
      setEppError(err?.message || "Failed to retrieve EPP code.");
    } finally { setEppLoading(false); }
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

  const handleRenewDomain = (domain: MyDomain) => {
    setRenewModalItem({
      id: domain.id,
      name: `${domain.name}${domain.tld}`,
      type: "domain",
      price: Number(domain.renewalPrice ?? domain.registrationPrice ?? 0),
      serviceType: "domain",
    });
    setManageDomainModal(null);
  };

  const handleToggleLock = async (domain: MyDomain) => {
    const currentLock = lockOverrides[domain.id] ?? domain.lockStatus ?? "locked";
    const isCurrentlyLocked = currentLock === "locked";

    // Client-side pre-check: show a clear message if still in 60-day window
    // (backend also enforces this — this gives instant feedback without a round-trip)
    if (isCurrentlyLocked) {
      const effectiveIn60Day = domain.isIn60DayLock && !domain.lockOverrideByAdmin;
      if (effectiveIn60Day) {
        toast({
          title: "Transfer Lock Cannot Be Removed",
          description: `Domain cannot be transferred within 60 days of registration. ${domain.daysRemainingInLock} day(s) remaining.`,
          variant: "destructive",
        });
        return;
      }
    }

    setLockLoading(domain.id);
    try {
      const data = await apiFetch(`/api/domains/${domain.id}/lock`, { method: "PUT" });
      setLockOverrides(prev => ({ ...prev, [domain.id]: data.lockStatus }));
      // Store EPP code inline when unlocking
      setEppOverrides(prev => ({ ...prev, [domain.id]: data.eppCode ?? null }));
      toast({
        title: data.lockStatus === "locked" ? "Transfer Lock Enabled" : "Transfer Lock Disabled",
        description: data.lockStatus === "unlocked"
          ? `${domain.name}${domain.tld} — EPP code is now visible below.`
          : `${domain.name}${domain.tld}`,
      });
    } catch (err: any) {
      const errCode = err?.error ?? err?.message ?? "";
      if (errCode === "60_DAY_LOCK" || String(errCode).includes("60")) {
        toast({
          title: "Transfer Lock Cannot Be Removed",
          description: err?.message ?? "Domain cannot be transferred within 60 days of registration.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: err?.message ?? "Failed to update transfer lock", variant: "destructive" });
      }
    } finally {
      setLockLoading(null);
    }
  };

  const handleCopyEpp = async (domainId: string, code: string) => {
    await navigator.clipboard.writeText(code);
    setEppCopiedId(domainId);
    setTimeout(() => setEppCopiedId(null), 2000);
  };

  const handleSearch = () => {
    const val = searchInput.trim().toLowerCase().split(".")[0];
    if (!val) return;
    setSearchQuery(val);
    setSuccess(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const addToCart = (result: TldResult) => {
    const key = `${searchData!.name}${result.tld}`;
    if (cart.some(c => `${c.name}${c.tld}` === key)) {
      toast({ title: "Already in cart", description: key });
      return;
    }
    const prices: { 1: number; 2: number; 3: number } = {
      1: result.registrationPrice,
      2: result.register2YearPrice ?? result.registrationPrice * 2,
      3: result.register3YearPrice ?? result.registrationPrice * 3,
    };
    setCart(prev => [...prev, { name: searchData!.name, tld: result.tld, prices, period: 1 }]);
    setShowCart(true);
    toast({ title: "Added to cart", description: key });
  };

  const removeFromCart = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));

  const updatePeriod = (idx: number, period: 1 | 2 | 3) => {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, period } : item));
  };

  const handleGoToReview = () => {
    if (cart.length === 0) return;
    setShowCart(false);
    setOrderView("review");
  };

  const handlePlaceOrder = async (promoCode = "", paymentMethodId: string | null = null) => {
    if (cart.length === 0 || checkingOut) return;
    setCheckingOut(true);
    const errors: string[] = [];
    let lastSuccess: OrderSuccess | null = null;

    for (const item of cart) {
      try {
        const token = localStorage.getItem("token");
        const cleanedNs = orderNameservers.map(n => n.trim()).filter(Boolean);
        const nameserversToSend = cleanedNs.length >= 2 ? cleanedNs : ["ns1.noehost.com", "ns2.noehost.com"];
        const body: Record<string, unknown> = { domain: item.name, tld: item.tld, period: item.period, nameservers: nameserversToSend };
        if (promoCode.trim()) body.promoCode = promoCode.trim();
        if (paymentMethodId) body.paymentMethodId = paymentMethodId;
        const res = await fetch("/api/checkout/domain", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to place order");
        lastSuccess = {
          domain: data.order?.domain || `${item.name}${item.tld}`,
          invoiceNumber: data.invoice?.invoiceNumber || "",
          amount: data.invoice?.amount || getPriceForPeriod(item),
          period: item.period,
          invoiceDueDate: data.invoice?.dueDate || null,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `Failed to register ${item.name}${item.tld}`;
        errors.push(msg);
      }
    }

    setCheckingOut(false);

    if (errors.length > 0 && !lastSuccess) {
      toast({ title: "Order failed", description: errors[0], variant: "destructive" });
      return;
    }

    if (lastSuccess) {
      setSuccess(lastSuccess);
      setOrderView("success");
      queryClient.invalidateQueries({ queryKey: ["my-domains"] });
      setCart([]);
      setSearchQuery(null);
      setSearchInput("");
      setOrderNameservers(["ns1.noehost.com", "ns2.noehost.com"]);
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
          {cart.length > 0 && activeTab === "order" && orderView === "search" && (
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
            onClick={() => navigate("/client/domains/transfer")}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border hover:border-primary/40 text-foreground rounded-xl font-medium text-sm transition-colors"
          >
            <ArrowRightLeft size={16} /> Transfer Domain
          </button>
          <button
            onClick={() => { setActiveTab("order"); setOrderView("search"); setTimeout(() => inputRef.current?.focus(), 100); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium text-sm shadow-lg shadow-primary/20 transition-colors"
          >
            <Globe size={16} /> Order New Domain
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-secondary/50 border border-border rounded-xl p-1 w-fit">
        {(["my-domains", "order", "transfers"] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab === "my-domains" ? `My Domains (${myDomains.length})` : tab === "order" ? "Order New Domain" : "Transfers"}
          </button>
        ))}
      </div>

      {activeTab === "order" && (
        <div className="space-y-6">
          {orderView === "success" && success ? (
            <SuccessBanner
              success={success}
              onOrderMore={() => { setSuccess(null); setOrderView("search"); setActiveTab("my-domains"); }}
              onPayInvoice={() => navigate("/client/invoices")}
            />
          ) : orderView === "review" ? (
            <ReviewStep
              cart={cart}
              onBack={() => { setOrderView("search"); setShowCart(true); }}
              onUpdatePeriod={updatePeriod}
              onRemove={removeFromCart}
              onPlaceOrder={handlePlaceOrder}
              isLoading={checkingOut}
              nameservers={orderNameservers}
              onNameserversChange={setOrderNameservers}
            />
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
                  Availability checked via RDAP — only TLDs configured by admin are shown.
                </p>
              </div>

              {searchError && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                  <AlertCircle size={20} />
                  <div>
                    <p className="font-medium">Search failed</p>
                    <p className="text-sm">{(searchError as Error).message || "Please check your domain name and try again."}</p>
                  </div>
                </div>
              )}

              {searchData && !searching && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-lg">
                      Results for <span className="text-primary font-mono">{searchData.name}</span>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {searchData.results.filter(r => r.available).length} of {searchData.results.length} TLDs available
                    </p>
                  </div>
                  {searchData.results.length === 0 ? (
                    <div className="bg-card border border-border/50 border-dashed rounded-3xl p-12 text-center">
                      <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                      <h3 className="text-xl font-bold text-foreground">No TLDs configured</h3>
                      <p className="text-muted-foreground mt-2">Admin has not added any active domain extensions yet.</p>
                    </div>
                  ) : (
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
                  )}
                </div>
              )}

              {!searchData && !searching && !searchError && (
                <div className="bg-card border border-border/50 border-dashed rounded-3xl p-16 text-center">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20">
                    <Globe className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-foreground">Find Your Perfect Domain</h3>
                  <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                    Type a domain name above to check availability across all TLDs configured by your admin.
                  </p>
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
              const lockStatus = lockOverrides[domain.id] ?? domain.lockStatus ?? "unlocked";
              const isLocked = lockStatus === "locked";
              return (
                <div key={domain.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/20 transition-all">
                  {/* Domain row */}
                  <div className="flex items-start justify-between gap-4 p-5">
                    <div className="flex items-center gap-4 min-w-0">
                      <TldIcon tld={domain.tld} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-foreground font-mono">{domain.name}{domain.tld}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[domain.status] ?? "bg-secondary text-muted-foreground border-border"}`}>
                            {statusLabels[domain.status] ?? domain.status}
                          </span>
                          {isExpiringSoon && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              <AlertCircle className="w-3 h-3" /> Expiring soon
                            </span>
                          )}
                          {isLocked && !domain.isIn60DayLock && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20">
                              <Lock className="w-3 h-3" /> Transfer Locked
                            </span>
                          )}
                          {domain.isIn60DayLock && !domain.lockOverrideByAdmin && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              <Lock className="w-3 h-3" /> 60-Day Lock · {domain.daysRemainingInLock}d
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                          {expiryDate ? `Expires ${format(expiryDate, "MMM d, yyyy")}` : ""}
                          {daysLeft !== null && ` · ${daysLeft}d left`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setManageDomainModal(domain)}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                        domain.status === "active" || domain.status === "expired"
                          ? "bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary"
                          : domain.status === "pending"
                            ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20"
                            : "bg-secondary/50 border-border text-muted-foreground hover:bg-secondary cursor-not-allowed opacity-70"
                      }`}
                    >
                      <Settings size={14} />
                      {domain.status === "pending" ? "Pay Now" : "Manage"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "transfers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Track the status of your domain transfer requests.</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/client/domains/transfer")} className="gap-2">
              <ArrowRightLeft size={14} /> New Transfer
            </Button>
          </div>
          {transfersLoading ? (
            <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : myTransfers.length === 0 ? (
            <div className="bg-card border border-border border-dashed rounded-3xl p-12 text-center">
              <ArrowRightLeft className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="text-xl font-bold text-foreground">No transfer requests</h3>
              <p className="text-muted-foreground mt-2">Initiate a domain transfer to bring your domains to Noehost.</p>
              <Button onClick={() => navigate("/client/domains/transfer")} className="mt-6 bg-primary text-white gap-2">
                <ArrowRightLeft size={16} /> Transfer a Domain
              </Button>
            </div>
          ) : (
            myTransfers.map(transfer => {
              const statusColors: Record<string, string> = {
                pending:    "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
                validating: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                approved:   "bg-green-500/10 text-green-400 border-green-500/20",
                rejected:   "bg-red-500/10 text-red-400 border-red-500/20",
                completed:  "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                cancelled:  "bg-secondary text-muted-foreground border-border",
              };
              const statusLabels: Record<string, string> = {
                pending: "Pending", validating: "Validating", approved: "Approved",
                rejected: "Rejected", completed: "Completed", cancelled: "Cancelled",
              };
              const canCancel = ["pending", "validating"].includes(transfer.status);
              return (
                <div key={transfer.id} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <ArrowRightLeft size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{transfer.domainName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColors[transfer.status] ?? "bg-secondary text-muted-foreground border-border"}`}>
                        {statusLabels[transfer.status] ?? transfer.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Transfer fee: {formatPrice(parseFloat(transfer.price))}</span>
                      <span>Submitted: {format(new Date(transfer.createdAt), "MMM d, yyyy")}</span>
                    </div>
                    {transfer.validationMessage && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{transfer.validationMessage}</p>
                    )}
                  </div>
                  {canCancel && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelTransfer(transfer.id)}
                      disabled={cancellingId === transfer.id}
                      className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      {cancellingId === transfer.id ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
                      Cancel
                    </Button>
                  )}
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
          onReview={handleGoToReview}
          total={getCartTotal(cart)}
        />
      )}

      {/* ─── Manage Domain Modal ─── */}
      {manageDomainModal && (() => {
        const md = manageDomainModal;
        const isPending = md.status === "pending";
        const isCancelled = md.status === "cancelled";
        const isPendingTransfer = md.status === "pending_transfer";
        const mdLockStatus = lockOverrides[md.id] ?? md.lockStatus ?? "locked";
        const mdIsLocked = mdLockStatus === "locked";
        const mdEppCode = !mdIsLocked ? (eppOverrides[md.id] !== undefined ? eppOverrides[md.id] : md.eppCode) : null;
        const mdIn60Day = md.isIn60DayLock && !md.lockOverrideByAdmin;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setManageDomainModal(null)}>
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
              {/* Modal header */}
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h3 className="font-bold text-foreground font-mono">{md.name}{md.tld}</h3>
                  <span className={`inline-flex mt-1 items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[md.status] ?? "bg-secondary text-muted-foreground border-border"}`}>
                    {statusLabels[md.status] ?? md.status}
                  </span>
                </div>
                <button onClick={() => setManageDomainModal(null)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                  <X size={18} />
                </button>
              </div>

              {/* Status guard */}
              {(isPending || isCancelled || isPendingTransfer) ? (
                <div className="p-6 text-center space-y-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                    isPending ? "bg-yellow-500/10" : isCancelled ? "bg-secondary" : "bg-purple-500/10"
                  }`}>
                    <AlertCircle size={22} className={isPending ? "text-yellow-400" : isCancelled ? "text-muted-foreground" : "text-purple-400"} />
                  </div>
                  <p className="font-medium text-foreground">
                    {isPending ? "Payment Required" : isCancelled ? "Domain Cancelled" : "Transfer In Progress"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isPending
                      ? "Complete payment to activate this domain and access management settings."
                      : isCancelled
                        ? "This domain has been cancelled. Management settings are unavailable."
                        : "Domain settings cannot be changed while a transfer is in progress. Management will be available once the transfer completes."}
                  </p>
                  {isPending && (
                    <Button onClick={() => { setManageDomainModal(null); navigate("/client/invoices"); }} className="gap-2">
                      <Receipt size={15} /> Pay Now
                    </Button>
                  )}
                  {isPendingTransfer && (
                    <Button variant="outline" onClick={() => { setManageDomainModal(null); }} className="gap-2">
                      View Transfer Status
                    </Button>
                  )}
                </div>
              ) : (
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Renew Domain */}
                    <button
                      className="flex items-center gap-3 p-3 bg-secondary/40 border border-border rounded-xl hover:border-green-500/40 hover:bg-green-500/5 transition-all text-left"
                      onClick={() => handleRenewDomain(md)}
                      disabled={renewLoading}
                    >
                      <div className="w-9 h-9 bg-green-500/10 rounded-lg flex items-center justify-center shrink-0">
                        {renewLoading ? <Loader2 size={15} className="animate-spin text-green-400" /> : <RefreshCw size={15} className="text-green-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Renew Domain</p>
                        <p className="text-xs text-muted-foreground">Creates renewal invoice</p>
                      </div>
                    </button>

                    {/* Nameservers */}
                    <button
                      className="flex items-center gap-3 p-3 bg-secondary/40 border border-border rounded-xl hover:border-blue-500/40 hover:bg-blue-500/5 transition-all text-left"
                      onClick={() => { setManageDomainModal(null); setDnsModal(md); }}
                    >
                      <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center shrink-0">
                        <Server size={15} className="text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Nameservers</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{md.nameservers?.[0] ?? "ns1.noehost.com"}</p>
                      </div>
                    </button>

                    {/* DNS Management */}
                    <button
                      className="flex items-center gap-3 p-3 bg-secondary/40 border border-border rounded-xl hover:border-violet-500/40 hover:bg-violet-500/5 transition-all text-left"
                      onClick={() => { setManageDomainModal(null); navigate(`/client/dns/${md.id}`); }}
                    >
                      <div className="w-9 h-9 bg-violet-500/10 rounded-lg flex items-center justify-center shrink-0">
                        <Network size={15} className="text-violet-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">DNS Management</p>
                        <p className="text-xs text-muted-foreground">A, CNAME, MX records</p>
                      </div>
                    </button>

                    {/* Get EPP Code — only shown when unlocked */}
                    {!mdIsLocked && (
                      <button
                        className="flex items-center gap-3 p-3 bg-secondary/40 border border-amber-500/30 rounded-xl hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left"
                        onClick={() => { setManageDomainModal(null); openEppModal(md); }}
                      >
                        <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center shrink-0">
                          <Key size={15} className="text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Get EPP Code</p>
                          <p className="text-xs text-muted-foreground">Auth code for transfer</p>
                        </div>
                      </button>
                    )}

                    {/* Transfer Lock — full section spanning 2 cols when in 60-day lock */}
                    <button
                      disabled={lockLoading === md.id || mdIn60Day}
                      className={`flex items-center gap-3 p-3 bg-secondary/40 border rounded-xl transition-all text-left ${
                        mdIn60Day
                          ? "border-orange-500/30 cursor-not-allowed opacity-80"
                          : mdIsLocked
                            ? "border-red-500/30 hover:border-red-400/50 hover:bg-red-500/5"
                            : "border-green-500/30 hover:border-green-400/50 hover:bg-green-500/5"
                      }`}
                      onClick={() => !mdIn60Day && handleToggleLock(md)}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        mdIn60Day ? "bg-orange-500/10" : mdIsLocked ? "bg-red-500/10" : "bg-green-500/10"
                      }`}>
                        {lockLoading === md.id
                          ? <Loader2 size={15} className="animate-spin text-muted-foreground" />
                          : mdIn60Day
                            ? <Lock size={15} className="text-orange-400" />
                            : mdIsLocked
                              ? <Lock size={15} className="text-red-400" />
                              : <ShieldCheck size={15} className="text-green-400" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Transfer Lock</p>
                        <p className={`text-xs font-medium truncate ${
                          mdIn60Day ? "text-orange-400" : mdIsLocked ? "text-red-400" : "text-green-400"
                        }`}>
                          {mdIn60Day
                            ? `Locked — ${md.daysRemainingInLock}d remaining`
                            : mdIsLocked
                              ? "Locked — click to unlock"
                              : "Unlocked — click to lock"
                          }
                        </p>
                      </div>
                    </button>

                    {/* Auto Renew toggle */}
                    <button
                      className="flex items-center gap-3 p-3 bg-secondary/40 border border-border rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                      onClick={() => toggleAutoRenew(md.id, md.autoRenew)}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${md.autoRenew ? "bg-green-500/10" : "bg-secondary"}`}>
                        <RotateCcw size={15} className={md.autoRenew ? "text-green-400" : "text-muted-foreground"} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Auto-Renew</p>
                        <p className={`text-xs font-medium ${md.autoRenew ? "text-green-400" : "text-muted-foreground"}`}>
                          {md.autoRenew ? "Enabled" : "Disabled"}
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* ── 60-Day Registration Lock Banner ── */}
                  {mdIn60Day && (
                    <div className="flex items-start gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Lock size={14} className="text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-orange-400">60-Day Registration Lock Active</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Domain cannot be transferred within 60 days of registration.{" "}
                          <span className="font-bold text-orange-300">{md.daysRemainingInLock} day{md.daysRemainingInLock !== 1 ? "s" : ""} remaining.</span>
                          {md.lockOverrideByAdmin && (
                            <span className="ml-1 text-green-400 font-medium">Admin override active.</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── EPP Code Inline Display (when unlocked) ── */}
                  {!mdIsLocked && mdEppCode && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Key size={14} className="text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-400">EPP / Auth Code</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <code className="flex-1 bg-black/30 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground tracking-widest truncate">
                            {mdEppCode}
                          </code>
                          <button
                            onClick={() => handleCopyEpp(md.id, mdEppCode)}
                            className="shrink-0 p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 transition-colors"
                            title="Copy EPP code"
                          >
                            {eppCopiedId === md.id ? <CheckCheck size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Share this code with the receiving registrar to complete the domain transfer. Lock the domain again to invalidate this code.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Domain info footer */}
                  <div className="pt-3 border-t border-border/50 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    {md.registrationDate && <span>Registered: {format(new Date(md.registrationDate), "MMM d, yyyy")}</span>}
                    {md.expiryDate && <span>Expires: {format(new Date(md.expiryDate), "MMM d, yyyy")}</span>}
                    {md.nameservers?.[0] && <span>NS: {md.nameservers[0]}</span>}
                    {md.lastLockChange && <span>Lock changed: {format(new Date(md.lastLockChange), "MMM d, yyyy")}</span>}
                    {md.lockOverrideByAdmin && <span className="text-green-400 font-medium">Admin override active</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {dnsModal && (
        <DnsModal
          domain={dnsModal}
          onClose={() => setDnsModal(null)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ["my-domains"] }); setDnsModal(null); }}
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
              <button onClick={() => { setEppModal(null); setEppCode(null); setEppError(null); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Use this authorization code to initiate a domain transfer to another registrar. Keep it confidential.
            </p>
            <div className="bg-secondary rounded-xl p-4 mb-4">
              {eppLoading ? (
                <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Fetching auth code…</span>
                </div>
              ) : eppError ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-red-400">
                    <Lock size={15} className="shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{eppError}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">To get the EPP code, first disable the transfer lock in the domain management panel.</p>
                </div>
              ) : eppCode ? (
                <div className="flex items-center justify-between gap-3">
                  <code className="font-mono text-base font-bold text-primary tracking-wider break-all">{eppCode}</code>
                  <button onClick={copyEppCode} className="shrink-0 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors" title="Copy to clipboard">
                    {eppCopied ? <CheckCheck size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Unable to retrieve auth code.</p>
              )}
            </div>
            {!eppError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>This code is valid for domain transfer only. Keep it private.</span>
              </div>
            )}
            <Button className="w-full mt-4" variant="outline" onClick={() => { setEppModal(null); setEppCode(null); setEppError(null); }}>Close</Button>
          </div>
        </div>
      )}

      {renewModalItem && (
        <RenewalCartModal
          item={renewModalItem}
          onClose={() => setRenewModalItem(null)}
          onSuccess={(invoiceId, invoiceNumber) => {
            setRenewModalItem(null);
            toast({ title: "Renewal order placed", description: `Invoice ${invoiceNumber} created successfully.` });
            navigate(`/client/invoices/${invoiceId}`);
          }}
        />
      )}
    </div>
  );
}

function TldCard({ name, result, inCart, onAddToCart }: {
  name: string;
  result: TldResult;
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
        <TldIcon tld={result.tld} />
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
          {(result.register2YearPrice || result.register3YearPrice) && (
            <div className="flex gap-2 mt-1.5">
              {result.register2YearPrice && (
                <span className="text-xs bg-secondary border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                  2yr: {formatPrice(result.register2YearPrice)}
                </span>
              )}
              {result.register3YearPrice && (
                <span className="text-xs bg-secondary border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                  3yr: {formatPrice(result.register3YearPrice)}
                </span>
              )}
            </div>
          )}
        </div>
        {result.available ? (
          inCart ? (
            <span className="flex items-center gap-1.5 text-primary text-sm font-medium">
              <BadgeCheck size={16} /> In Cart
            </span>
          ) : (
            <Button size="sm" onClick={onAddToCart} className="bg-primary hover:bg-primary/90 text-white gap-1.5 h-9">
              <ShoppingCart size={14} /> Add
            </Button>
          )
        ) : (
          <Button size="sm" variant="ghost" disabled className="h-9 text-muted-foreground">Taken</Button>
        )}
      </div>
    </div>
  );
}

function CartDrawer({ cart, onClose, onRemove, onUpdatePeriod, onReview, total }: {
  cart: CartItem[];
  onClose: () => void;
  onRemove: (idx: number) => void;
  onUpdatePeriod: (idx: number, period: 1 | 2 | 3) => void;
  onReview: () => void;
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
                    {item.period} year{item.period > 1 ? "s" : ""} — <span className="text-foreground font-semibold">{formatPrice(getPriceForPeriod(item))}</span>
                  </p>
                </div>
                <button onClick={() => onRemove(idx)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                  <Trash2 size={15} />
                </button>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Registration Period</label>
                <div className="flex gap-2">
                  {([1, 2, 3] as (1 | 2 | 3)[]).map(yr => (
                    <button
                      key={yr}
                      onClick={() => onUpdatePeriod(idx, yr)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        item.period === yr
                          ? "bg-primary border-primary text-white"
                          : "bg-background border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {yr}yr — {formatPrice(item.prices[yr])}
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
                <span>{formatPrice(getPriceForPeriod(item))}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-lg border-t border-border pt-2 mt-2">
              <span>Total</span>
              <span className="text-primary">{formatPrice(total)}</span>
            </div>
          </div>

          <Button
            onClick={onReview}
            disabled={cart.length === 0}
            className="w-full bg-primary hover:bg-primary/90 text-white h-12 font-bold text-base gap-2 shadow-lg shadow-primary/20"
          >
            <ClipboardList size={18} /> Review Order
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Review your order before payment. Domain activates after admin approval.
          </p>
        </div>
      </div>
    </div>
  );
}

interface DomainPaymentMethod {
  id: string; name: string; type: string; description: string | null;
  isSandbox: boolean;
  publicSettings: {
    bankName?: string; accountTitle?: string; accountNumber?: string;
    mobileNumber?: string; paypalEmail?: string;
  };
}

function DomainPayIcon({ type }: { type: string }) {
  switch (type) {
    case "jazzcash":      return <Smartphone size={18} style={{ color: "#f0612e" }}/>;
    case "easypaisa":    return <Smartphone size={18} style={{ color: "#3bb54a" }}/>;
    case "bank_transfer":return <Landmark   size={18} style={{ color: "#1d4ed8" }}/>;
    case "stripe":       return <CreditCard size={18} style={{ color: "#635bff" }}/>;
    case "paypal":       return <Wallet     size={18} style={{ color: "#003087" }}/>;
    default:             return <CreditCard size={18} className="text-muted-foreground"/>;
  }
}

function ReviewStep({ cart, onBack, onUpdatePeriod, onRemove, onPlaceOrder, isLoading, nameservers, onNameserversChange }: {
  cart: CartItem[];
  onBack: () => void;
  onUpdatePeriod: (idx: number, period: 1 | 2 | 3) => void;
  onRemove: (idx: number) => void;
  onPlaceOrder: (promoCode: string, paymentMethodId: string | null) => void;
  isLoading: boolean;
  nameservers: string[];
  onNameserversChange: (ns: string[]) => void;
}) {
  const { formatPrice } = useCurrency();
  const rawTotal = getCartTotal(cart);

  const [promoCode,     setPromoCode]     = useState("");
  const [promoLoading,  setPromoLoading]  = useState(false);
  const [promoApplied,  setPromoApplied]  = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError,    setPromoError]    = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods]   = useState<DomainPaymentMethod[]>([]);
  const [creditBalance,  setCreditBalance]    = useState(0);
  const [pmLoading,      setPmLoading]        = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token") || "";
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch("/api/payment-methods", { headers }).then(r => r.ok ? r.json() : []),
      fetch("/api/client/profile", { headers }).then(r => r.ok ? r.json() : {}),
    ]).then(([pms, profile]) => {
      setPaymentMethods(Array.isArray(pms) ? pms.filter((p: DomainPaymentMethod & { isActive?: boolean }) => p.isActive !== false) : []);
      setCreditBalance(parseFloat(profile?.creditBalance ?? "0") || 0);
    }).catch(() => {}).finally(() => setPmLoading(false));
  }, []);

  const total = Math.max(0, rawTotal - promoDiscount);

  async function handleApplyPromo() {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    setPromoApplied(false);
    setPromoDiscount(0);
    try {
      const token = localStorage.getItem("token") || "";
      const params = new URLSearchParams({ code: promoCode.trim(), amount: String(rawTotal), serviceType: "domain" });
      const res = await fetch(`/api/promo-codes/validate?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data.error) { setPromoError(data.error || "Invalid promo code"); return; }
      setPromoDiscount(data.discountAmount ?? 0);
      setPromoApplied(true);
    } catch {
      setPromoError("Failed to validate promo code");
    } finally {
      setPromoLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft size={16} /> Back to Cart
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <ClipboardList size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">Review Your Order</h3>
              <p className="text-xs text-muted-foreground">Check the details before placing your order</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {cart.map((item, idx) => (
            <div key={idx} className="bg-background border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <TldIcon tld={item.tld} />
                  <div>
                    <p className="font-mono font-bold text-foreground text-lg">
                      <span>{item.name}</span><span className="text-primary">{item.tld}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Domain Registration</p>
                  </div>
                </div>
                <button onClick={() => onRemove(idx)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Registration Period</p>
                <div className="flex gap-2">
                  {([1, 2, 3] as (1 | 2 | 3)[]).map(yr => (
                    <button
                      key={yr}
                      onClick={() => onUpdatePeriod(idx, yr)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                        item.period === yr
                          ? "bg-primary border-primary text-white shadow-md shadow-primary/20"
                          : "bg-card border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <span className="block">{yr} Year{yr > 1 ? "s" : ""}</span>
                      <span className={`block text-xs font-normal mt-0.5 ${item.period === yr ? "text-white/80" : "text-muted-foreground"}`}>
                        {formatPrice(item.prices[yr])}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-bold text-foreground">{formatPrice(getPriceForPeriod(item))}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-border bg-secondary/20 space-y-4">
          <div className="space-y-2">
            {cart.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-muted-foreground font-mono">{item.name}{item.tld} ({item.period}yr)</span>
                <span>{formatPrice(getPriceForPeriod(item))}</span>
              </div>
            ))}
            {promoApplied && promoDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-500 font-semibold">
                <span className="flex items-center gap-1.5"><Tag size={12}/> Promo: {promoCode}</span>
                <span>-{formatPrice(promoDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-xl border-t border-border pt-3 mt-2">
              <span>Total Due</span>
              <span className="text-primary">{formatPrice(total)}</span>
            </div>
          </div>

          {/* Promo Code */}
          <div className="bg-background border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-primary" />
              <p className="text-sm font-semibold text-foreground">Promo Code (Optional)</p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <input
                  value={promoCode}
                  onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoApplied(false); setPromoDiscount(0); setPromoError(""); }}
                  placeholder="Enter promo code"
                  className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm font-mono uppercase focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleApplyPromo}
                disabled={promoLoading || !promoCode.trim()}
                className={promoApplied ? "border-green-500 text-green-500 hover:text-green-600" : ""}
              >
                {promoLoading ? <Loader2 size={13} className="animate-spin"/> : promoApplied ? <CheckCircle2 size={13}/> : null}
                <span className="ml-1">{promoApplied ? "Applied" : "Apply"}</span>
              </Button>
            </div>
            {promoError && (
              <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11}/> {promoError}</p>
            )}
            {promoApplied && promoDiscount > 0 && (
              <p className="text-xs text-green-500 flex items-center gap-1 font-semibold"><CheckCircle2 size={11}/> Saved {formatPrice(promoDiscount)}!</p>
            )}
          </div>

          {/* Payment Method */}
          <div className="bg-background border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard size={14} className="text-primary" />
              <p className="text-sm font-semibold text-foreground">Payment Method</p>
            </div>
            {pmLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 size={13} className="animate-spin"/> Loading payment options…
              </div>
            ) : (
              <div className="space-y-2">
                {/* Wallet option */}
                {(() => {
                  const hasSufficient = creditBalance >= total;
                  return (
                    <button
                      onClick={() => setPaymentMethodId(paymentMethodId === "credits" ? null : "credits")}
                      disabled={!hasSufficient && total > 0}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
                        paymentMethodId === "credits" ? "border-primary bg-primary/5" : "border-border bg-card"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${paymentMethodId === "credits" ? "bg-primary/15" : "bg-secondary"}`}>
                        <Wallet size={16} className={paymentMethodId === "credits" ? "text-primary" : "text-muted-foreground"}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Wallet Balance</p>
                        <p className={`text-xs font-medium ${creditBalance > 0 ? (hasSufficient ? "text-green-500" : "text-red-400") : "text-muted-foreground"}`}>
                          {formatPrice(creditBalance)} available
                          {!hasSufficient && total > 0 && ` — need ${formatPrice(total - creditBalance)} more`}
                        </p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${paymentMethodId === "credits" ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                        {paymentMethodId === "credits" && <CheckCircle2 size={10} className="text-white"/>}
                      </div>
                    </button>
                  );
                })()}
                {/* Other payment methods */}
                {paymentMethods.map(pm => {
                  const isSel = paymentMethodId === pm.id;
                  return (
                    <button key={pm.id} onClick={() => setPaymentMethodId(isSel ? null : pm.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all focus:outline-none ${
                        isSel ? "border-primary bg-primary/5" : "border-border bg-card"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isSel ? "bg-primary/15" : "bg-secondary"}`}>
                        <DomainPayIcon type={pm.type}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-foreground">{pm.name}</p>
                          {pm.isSandbox && <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">Test</span>}
                        </div>
                        {pm.description && <p className="text-xs text-muted-foreground truncate">{pm.description}</p>}
                        {(pm.type === "jazzcash" || pm.type === "easypaisa") && pm.publicSettings.mobileNumber && (
                          <p className="text-xs text-muted-foreground">Send to: {pm.publicSettings.mobileNumber}</p>
                        )}
                        {pm.type === "bank_transfer" && pm.publicSettings.bankName && (
                          <p className="text-xs text-muted-foreground">{pm.publicSettings.bankName} · {pm.publicSettings.accountTitle}</p>
                        )}
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${isSel ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                        {isSel && <CheckCircle2 size={10} className="text-white"/>}
                      </div>
                    </button>
                  );
                })}
                {paymentMethods.length === 0 && creditBalance === 0 && (
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                    <AlertCircle size={13}/> No payment methods configured. Please contact support.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nameservers */}
          <div className="bg-background border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Network size={15} className="text-primary" />
              <p className="text-sm font-semibold text-foreground">Nameservers</p>
            </div>
            <p className="text-xs text-muted-foreground">Default Noehost nameservers are pre-filled. You can enter custom nameservers if needed.</p>
            <div className="space-y-2">
              {nameservers.map((ns, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-muted-foreground w-8 shrink-0">NS{i + 1}</span>
                  <input
                    value={ns}
                    onChange={e => onNameserversChange(nameservers.map((v, idx) => idx === i ? e.target.value : v))}
                    placeholder={`ns${i + 1}.example.com`}
                    className="flex-1 px-3 py-2 bg-card border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-primary transition-colors"
                  />
                  {nameservers.length > 2 && (
                    <button type="button" onClick={() => onNameserversChange(nameservers.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-red-400 transition-colors text-lg leading-none p-1">×</button>
                  )}
                </div>
              ))}
              {nameservers.length < 4 && (
                <button type="button"
                  onClick={() => onNameserversChange([...nameservers, ""])}
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors mt-1">
                  <Plus size={12} /> Add nameserver
                </button>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-200 mb-0.5">What happens next?</p>
              <p>An invoice will be generated. Your domain will be activated after admin approval and payment confirmation.</p>
            </div>
          </div>

          <Button
            onClick={() => onPlaceOrder(promoCode, paymentMethodId)}
            disabled={isLoading || cart.length === 0}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold text-base gap-2 shadow-lg shadow-primary/20"
          >
            {isLoading ? (
              <><Loader2 className="animate-spin" size={18} /> Placing Order…</>
            ) : (
              <><ChevronRight size={18} /> Place Order — {formatPrice(total)}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SuccessBanner({ success, onOrderMore, onPayInvoice }: {
  success: OrderSuccess;
  onOrderMore: () => void;
  onPayInvoice: () => void;
}) {
  const { formatPrice } = useCurrency();
  return (
    <div className="bg-card border border-emerald-500/30 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/5 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-primary/5 pointer-events-none" />
      <div className="relative z-10 p-10 text-center">
        <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h3 className="text-2xl font-display font-bold text-foreground">Order Placed!</h3>
        <p className="text-muted-foreground mt-2 text-lg">
          <span className="font-mono text-foreground font-bold">{success.domain}</span> is pending approval.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-lg mx-auto">
          <div className="bg-background/60 border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Domain</p>
            <p className="font-mono font-bold text-sm">{success.domain}</p>
          </div>
          <div className="bg-background/60 border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Invoice</p>
            <p className="font-bold text-sm">{success.invoiceNumber || "Pending"}</p>
          </div>
          <div className="bg-background/60 border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Amount Due</p>
            <p className="font-bold text-sm text-primary">{formatPrice(success.amount)}</p>
          </div>
        </div>

        {success.invoiceDueDate && (
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl max-w-lg mx-auto text-sm text-blue-300 flex items-start gap-3">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              Invoice <strong>{success.invoiceNumber}</strong> is due by{" "}
              {format(new Date(success.invoiceDueDate), "MMM d, yyyy")}. Visit the Invoices section to pay.
            </span>
          </div>
        )}

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
    : ["ns1.noehost.com", "ns2.noehost.com", "", ""];

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
