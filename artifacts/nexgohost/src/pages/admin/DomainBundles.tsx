import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Layers, RefreshCw, ChevronDown, ChevronUp, Globe, Tag, ToggleLeft, ToggleRight, Gift, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const POPULAR_TLDS = [
  ".com", ".net", ".org", ".io", ".co", ".store", ".online", ".info", ".biz",
  ".pk", ".com.pk", ".net.pk", ".org.pk", ".edu.pk",
  ".uk", ".us", ".ca", ".au", ".de", ".fr", ".in", ".co.uk",
];

const DEFAULT_BUNDLES: Record<string, string[]> = {
  ".com":    [".net", ".org", ".store", ".io"],
  ".net":    [".com", ".org", ".io"],
  ".org":    [".com", ".net"],
  ".pk":     [".com.pk", ".net.pk", ".com"],
  ".com.pk": [".pk", ".net.pk"],
};

interface BundlePricingEntry {
  tld: string;
  price: number;
  isFree: boolean;
  isEnabled: boolean;
}

const DEFAULT_BUNDLE_PRICING: BundlePricingEntry[] = [
  { tld: ".store",  price: 599,  isFree: false, isEnabled: true },
  { tld: ".online", price: 299,  isFree: false, isEnabled: true },
  { tld: ".co.uk",  price: 1299, isFree: false, isEnabled: true },
  { tld: ".net",    price: 1799, isFree: false, isEnabled: true },
  { tld: ".org",    price: 1499, isFree: false, isEnabled: true },
  { tld: ".info",   price: 699,  isFree: false, isEnabled: false },
  { tld: ".biz",    price: 799,  isFree: false, isEnabled: false },
  { tld: ".io",     price: 3499, isFree: false, isEnabled: false },
];

async function apiFetch(method: string, path: string, body?: unknown) {
  const token = localStorage.getItem("token") || localStorage.getItem("noehost_token") || "";
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

export default function DomainBundles() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"suggestions" | "pricing">("pricing");

  // ── TLD Suggestions (existing) ──
  const [bundles, setBundles] = useState<Record<string, string[]>>(DEFAULT_BUNDLES);
  const [bundlesLoading, setBundlesLoading] = useState(true);
  const [bundlesSaving, setBundlesSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newMainTld, setNewMainTld] = useState("");
  const [newSubTld, setNewSubTld] = useState<Record<string, string>>({});

  // ── Ionos Bundle Pricing (new) ──
  const [pricing, setPricing] = useState<BundlePricingEntry[]>(DEFAULT_BUNDLE_PRICING);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [newTld, setNewTld] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newIsFree, setNewIsFree] = useState(false);

  useEffect(() => {
    apiFetch("GET", "/api/admin/domain-bundles")
      .then(d => { setBundles(d); setBundlesLoading(false); })
      .catch(() => { setBundles(DEFAULT_BUNDLES); setBundlesLoading(false); });

    apiFetch("GET", "/api/admin/domain-bundle-pricing")
      .then(d => { setPricing(Array.isArray(d) ? d : DEFAULT_BUNDLE_PRICING); setPricingLoading(false); })
      .catch(() => { setPricing(DEFAULT_BUNDLE_PRICING); setPricingLoading(false); });
  }, []);

  // ── Suggestions handlers ──
  const toggleExpand = (tld: string) => setExpanded(p => ({ ...p, [tld]: !p[tld] }));
  const addMainTld = () => {
    const t = newMainTld.trim().toLowerCase();
    if (!t) return;
    const tld = t.startsWith(".") ? t : "." + t;
    if (bundles[tld]) { toast({ title: "TLD already exists", variant: "destructive" }); return; }
    setBundles(p => ({ ...p, [tld]: [] }));
    setExpanded(p => ({ ...p, [tld]: true }));
    setNewMainTld("");
  };
  const removeMainTld = (tld: string) => {
    setBundles(p => { const n = { ...p }; delete n[tld]; return n; });
  };
  const addSubTld = (mainTld: string) => {
    const raw = (newSubTld[mainTld] || "").trim().toLowerCase();
    if (!raw) return;
    const sub = raw.startsWith(".") ? raw : "." + raw;
    if (bundles[mainTld]?.includes(sub)) { toast({ title: "Already in bundle", variant: "destructive" }); return; }
    setBundles(p => ({ ...p, [mainTld]: [...(p[mainTld] || []), sub] }));
    setNewSubTld(p => ({ ...p, [mainTld]: "" }));
  };
  const removeSubTld = (mainTld: string, sub: string) => {
    setBundles(p => ({ ...p, [mainTld]: p[mainTld].filter(t => t !== sub) }));
  };
  const handleSaveBundles = async () => {
    setBundlesSaving(true);
    try {
      await apiFetch("PUT", "/api/admin/domain-bundles", bundles);
      toast({ title: "Bundle config saved", description: "Changes appear in domain search immediately." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally { setBundlesSaving(false); }
  };

  // ── Pricing handlers ──
  const toggleEntry = (tld: string, field: "isEnabled" | "isFree") => {
    setPricing(p => p.map(e => e.tld === tld ? { ...e, [field]: !e[field] } : e));
  };
  const updatePrice = (tld: string, val: string) => {
    const n = parseInt(val) || 0;
    setPricing(p => p.map(e => e.tld === tld ? { ...e, price: n } : e));
  };
  const removeEntry = (tld: string) => {
    setPricing(p => p.filter(e => e.tld !== tld));
  };
  const addEntry = () => {
    const t = newTld.trim().toLowerCase();
    if (!t) return;
    const tld = t.startsWith(".") ? t : "." + t;
    if (pricing.find(e => e.tld === tld)) { toast({ title: "TLD already exists", variant: "destructive" }); return; }
    const price = parseInt(newPrice) || 0;
    setPricing(p => [...p, { tld, price, isFree: newIsFree, isEnabled: true }]);
    setNewTld(""); setNewPrice(""); setNewIsFree(false);
  };
  const handleSavePricing = async () => {
    setPricingSaving(true);
    try {
      await apiFetch("PUT", "/api/admin/domain-bundle-pricing", pricing);
      toast({ title: "Bundle pricing saved!", description: "Customers will see updated prices immediately." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally { setPricingSaving(false); }
  };

  if (bundlesLoading || pricingLoading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-primary" size={28} /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("pricing")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === "pricing" ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          🎁 Ionos Bundle Pricing
        </button>
        <button
          onClick={() => setActiveTab("suggestions")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === "suggestions" ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          🔗 TLD Suggestions
        </button>
      </div>

      {/* ── IONOS BUNDLE PRICING TAB ── */}
      {activeTab === "pricing" && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Gift size={20} className="text-primary" />
                Ionos-Style Domain Bundle Pricing
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                When a customer orders any domain (e.g. <strong>kalahost.com</strong>), these extensions are shown as bundle add-ons:
                <strong> kalahost.store</strong>, <strong>kalahost.co.uk</strong> etc. Set prices and toggle which ones appear.
              </p>
            </div>
            <button
              onClick={handleSavePricing}
              disabled={pricingSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-60 shrink-0"
            >
              {pricingSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              Save Pricing
            </button>
          </div>

          {/* How it works */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold mb-1">How Ionos-style bundles work</p>
            <p className="text-xs text-blue-500/80 dark:text-blue-300/70 leading-relaxed">
              When a customer selects any domain (e.g. <strong>kalahost.com</strong>), the order flow automatically shows
              bundle options for the <strong>same base name</strong>: <strong>kalahost.store</strong>, <strong>kalahost.co.uk</strong>, etc.
              Free extensions are auto-selected. Paid extensions are shown as optional add-ons. 
              Each selected bundle domain becomes its own order + invoice line item.
            </p>
          </div>

          {/* Pricing table */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="grid grid-cols-[1fr_120px_80px_80px_40px] gap-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40 px-4 py-2.5 border-b border-border">
              <span>Extension</span>
              <span>Price (PKR/yr)</span>
              <span className="text-center">Free?</span>
              <span className="text-center">Active</span>
              <span></span>
            </div>
            {pricing.map(entry => (
              <div key={entry.tld}
                className={`grid grid-cols-[1fr_120px_80px_80px_40px] gap-0 items-center px-4 py-3 border-b border-border last:border-b-0 transition-colors ${entry.isEnabled ? "" : "opacity-50 bg-muted/20"}`}>
                <div className="flex items-center gap-2">
                  <Globe size={13} className="text-primary shrink-0" />
                  <span className="font-mono font-bold text-foreground text-sm">{entry.tld}</span>
                  {entry.isFree && <span className="text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 px-1.5 py-0.5 rounded-full">FREE</span>}
                </div>
                <div>
                  {entry.isFree ? (
                    <span className="text-sm font-bold text-green-600">Free</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">PKR</span>
                      <input
                        type="number"
                        min="0"
                        value={entry.price}
                        onChange={e => updatePrice(entry.tld, e.target.value)}
                        className="w-20 h-7 px-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleEntry(entry.tld, "isFree")}
                    className={`p-1 rounded transition-colors ${entry.isFree ? "text-green-500" : "text-muted-foreground hover:text-green-500"}`}
                    title={entry.isFree ? "Mark as Paid" : "Mark as Free"}
                  >
                    {entry.isFree ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleEntry(entry.tld, "isEnabled")}
                    className={`p-1 rounded transition-colors ${entry.isEnabled ? "text-primary" : "text-muted-foreground"}`}
                    title={entry.isEnabled ? "Disable" : "Enable"}
                  >
                    {entry.isEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => removeEntry(entry.tld)}
                    className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add new entry */}
          <div className="border border-dashed border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Plus size={14} className="text-primary" /> Add Bundle Extension</p>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Extension (TLD)</label>
                <input
                  list="bundle-tld-list"
                  value={newTld}
                  onChange={e => setNewTld(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addEntry()}
                  placeholder=".shop, .pk, .us..."
                  className="h-9 px-3 w-36 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <datalist id="bundle-tld-list">
                  {POPULAR_TLDS.filter(t => !pricing.find(e => e.tld === t)).map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Price (PKR/yr)</label>
                <input
                  type="number"
                  min="0"
                  value={newPrice}
                  onChange={e => setNewPrice(e.target.value)}
                  placeholder="599"
                  disabled={newIsFree}
                  className="h-9 px-3 w-28 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Mark as Free?</label>
                <button
                  onClick={() => setNewIsFree(v => !v)}
                  className={`h-9 px-3 text-sm rounded-lg border transition-colors flex items-center gap-1.5 ${newIsFree ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30" : "border-border text-muted-foreground hover:border-primary/40"}`}
                >
                  <Gift size={13} /> {newIsFree ? "Yes – Free" : "No – Paid"}
                </button>
              </div>
              <button
                onClick={addEntry}
                className="h-9 flex items-center gap-1.5 px-4 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
              >
                <Plus size={13} /> Add
              </button>
            </div>
          </div>

          {/* Save button at bottom too */}
          <div className="flex justify-end">
            <button
              onClick={handleSavePricing}
              disabled={pricingSaving}
              className="flex items-center gap-2 px-6 py-2.5 text-sm rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-60 font-semibold"
            >
              {pricingSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              Save Bundle Pricing
            </button>
          </div>
        </div>
      )}

      {/* ── TLD SUGGESTIONS TAB ── */}
      {activeTab === "suggestions" && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Layers size={20} className="text-primary" />
                TLD Suggestion Bundles
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure which TLDs are shown in the right panel when a customer searches for a domain.
                For example, when someone searches <strong>.com</strong>, show them <strong>.net</strong>, <strong>.org</strong>, and <strong>.store</strong> as alternatives.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => { setBundles(DEFAULT_BUNDLES); toast({ title: "Reset to defaults", description: "Click Save to apply." }); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border bg-background hover:bg-muted transition-colors text-muted-foreground"
              >
                <RefreshCw size={13} /> Reset
              </button>
              <button
                onClick={handleSaveBundles}
                disabled={bundlesSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {bundlesSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                Save Changes
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {Object.keys(bundles).map(mainTld => (
              <div key={mainTld} className="border border-border rounded-xl overflow-hidden bg-card">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => toggleExpand(mainTld)}
                >
                  <div className="flex items-center gap-3">
                    <Globe size={15} className="text-primary" />
                    <span className="font-mono font-semibold text-foreground">{mainTld}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {bundles[mainTld]?.length || 0} bundled TLD{bundles[mainTld]?.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); removeMainTld(mainTld); }}
                      className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                    {expanded[mainTld] ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
                  </div>
                </div>

                {expanded[mainTld] && (
                  <div className="border-t border-border px-4 py-3 space-y-3">
                    {bundles[mainTld]?.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {bundles[mainTld].map(sub => (
                          <span key={sub} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 text-sm font-mono">
                            {sub}
                            <button onClick={() => removeSubTld(mainTld, sub)} className="hover:text-red-500 transition-colors ml-0.5">
                              <Trash2 size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No bundled TLDs yet. Add some below.</p>
                    )}
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <input
                          list={`sub-tld-list-${mainTld}`}
                          value={newSubTld[mainTld] || ""}
                          onChange={e => setNewSubTld(p => ({ ...p, [mainTld]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && addSubTld(mainTld)}
                          placeholder=".net, .store, .io ..."
                          className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                        <datalist id={`sub-tld-list-${mainTld}`}>
                          {POPULAR_TLDS.filter(t => t !== mainTld && !bundles[mainTld]?.includes(t)).map(t => <option key={t} value={t} />)}
                        </datalist>
                      </div>
                      <button
                        onClick={() => addSubTld(mainTld)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                      >
                        <Plus size={13} /> Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border border-dashed border-border rounded-xl p-4">
            <p className="text-sm font-medium text-foreground mb-2">Add a new TLD group</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  list="main-tld-list"
                  value={newMainTld}
                  onChange={e => setNewMainTld(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addMainTld()}
                  placeholder=".app, .dev, .shop ..."
                  className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <datalist id="main-tld-list">
                  {POPULAR_TLDS.filter(t => !bundles[t]).map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
              <button
                onClick={addMainTld}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
              >
                <Plus size={13} /> Add Group
              </button>
            </div>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">How suggestions work</p>
            <p className="text-xs text-blue-500/80 dark:text-blue-300/70 leading-relaxed">
              When a customer searches for a domain on the public website, the <strong>left panel</strong> shows the primary available domain
              and the <strong>right panel</strong> shows up to 3 bundled alternatives. These settings control what appears based on which TLD the customer's primary domain is.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
