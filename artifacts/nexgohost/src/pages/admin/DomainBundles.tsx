import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Layers, RefreshCw, ChevronDown, ChevronUp, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const POPULAR_TLDS = [
  ".com", ".net", ".org", ".io", ".co", ".store", ".online", ".info", ".biz",
  ".pk", ".com.pk", ".net.pk", ".org.pk", ".edu.pk",
  ".uk", ".us", ".ca", ".au", ".de", ".fr", ".in",
];

const DEFAULT_BUNDLES: Record<string, string[]> = {
  ".com":    [".net", ".org", ".store", ".io"],
  ".net":    [".com", ".org", ".io"],
  ".org":    [".com", ".net"],
  ".pk":     [".com.pk", ".net.pk", ".com"],
  ".com.pk": [".pk", ".net.pk"],
};

async function apiFetch(method: string, path: string, body?: unknown) {
  const token = localStorage.getItem("token") || localStorage.getItem("noehost_token") || "";
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function DomainBundles() {
  const { toast } = useToast();
  const [bundles, setBundles] = useState<Record<string, string[]>>(DEFAULT_BUNDLES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newMainTld, setNewMainTld] = useState("");
  const [newSubTld, setNewSubTld] = useState<Record<string, string>>({});

  useEffect(() => {
    apiFetch("GET", "/api/admin/domain-bundles")
      .then(d => { setBundles(d); setLoading(false); })
      .catch(() => { setBundles(DEFAULT_BUNDLES); setLoading(false); });
  }, []);

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
    if (bundles[mainTld]?.includes(sub)) {
      toast({ title: "Already in bundle", variant: "destructive" }); return;
    }
    setBundles(p => ({ ...p, [mainTld]: [...(p[mainTld] || []), sub] }));
    setNewSubTld(p => ({ ...p, [mainTld]: "" }));
  };

  const removeSubTld = (mainTld: string, sub: string) => {
    setBundles(p => ({ ...p, [mainTld]: p[mainTld].filter(t => t !== sub) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("PUT", "/api/admin/domain-bundles", bundles);
      toast({ title: "Bundle config saved", description: "Changes will appear in domain search immediately." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleReset = () => {
    setBundles(DEFAULT_BUNDLES);
    toast({ title: "Reset to defaults", description: "Click Save to apply." });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const mainTlds = Object.keys(bundles);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Layers size={20} className="text-primary" />
            Domain Bundle Manager
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure which TLDs are shown in the right panel when a customer searches for a domain.
            For example, when someone searches <strong>.com</strong>, show them <strong>.net</strong>, <strong>.org</strong>, and <strong>.store</strong> as alternatives.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border bg-background hover:bg-muted transition-colors text-muted-foreground"
          >
            <RefreshCw size={13} />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Bundle list */}
      <div className="space-y-3">
        {mainTlds.map(mainTld => (
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
                  title="Remove this TLD group"
                >
                  <Trash2 size={14} />
                </button>
                {expanded[mainTld] ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
              </div>
            </div>

            {expanded[mainTld] && (
              <div className="border-t border-border px-4 py-3 space-y-3">
                {/* Sub TLDs */}
                {bundles[mainTld]?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {bundles[mainTld].map(sub => (
                      <span key={sub} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 text-sm font-mono">
                        {sub}
                        <button
                          onClick={() => removeSubTld(mainTld, sub)}
                          className="hover:text-red-500 transition-colors ml-0.5"
                        >
                          <Trash2 size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No bundled TLDs yet. Add some below.</p>
                )}

                {/* Add sub TLD */}
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
                      {POPULAR_TLDS.filter(t => t !== mainTld && !bundles[mainTld]?.includes(t)).map(t => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                  <button
                    onClick={() => addSubTld(mainTld)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                  >
                    <Plus size={13} />
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new main TLD */}
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
              {POPULAR_TLDS.filter(t => !bundles[t]).map(t => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <button
            onClick={addMainTld}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} />
            Add Group
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">After adding, expand the group to configure which TLDs bundle with it.</p>
      </div>

      {/* Info card */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">How bundles work</p>
        <p className="text-xs text-blue-500/80 dark:text-blue-300/70 leading-relaxed">
          When a customer searches for a domain on the public website, the <strong>left panel</strong> shows the primary available domain
          and the <strong>right panel</strong> shows up to 3 bundled alternatives. These settings control what appears in the right panel
          based on which TLD the customer's primary domain is.
        </p>
      </div>
    </div>
  );
}
