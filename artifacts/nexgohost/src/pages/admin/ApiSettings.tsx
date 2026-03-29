import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Key, RefreshCw, Globe, Webhook, CheckCircle2, XCircle,
  Copy, RotateCcw, ShieldCheck, AlertTriangle, Wifi, WifiOff,
  Clock, TrendingUp, Loader2, Info,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const BRAND = "#4F46E5";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApiKeyData {
  apiKey: string | null;
  configured: boolean;
  usage: { header: string; example: string };
}

interface CacheStatus {
  lastRefreshed: string | null;
  ageHours: number | null;
  cacheFresh: boolean;
  nextRefreshInHours: number;
}

interface CurrencyRow {
  code: string; name: string; symbol: string; exchangeRate: string;
  isDefault: boolean; isActive: boolean;
}

interface SyncTestResult {
  ok: boolean;
  plans?: number;
  extensions?: number;
  currencies?: number;
  error?: string;
  latencyMs?: number;
}

// ─── Helper: copy to clipboard ────────────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }
  return { copied, copy };
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Card({ title, icon: Icon, children, badge }: {
  title: string; icon: any; children: React.ReactNode; badge?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${BRAND}18` }}>
          <Icon className="w-4 h-4" style={{ color: BRAND }} />
        </div>
        <h2 className="font-semibold text-gray-800 text-sm">{title}</h2>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── StatusPill ───────────────────────────────────────────────────────────────
function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ApiSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { copied, copy } = useCopy();
  const [showKey, setShowKey] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncTestResult | null>(null);
  const [syncTesting, setSyncTesting] = useState(false);

  // ── Data fetches ────────────────────────────────────────────────────────────
  const { data: keyData, isLoading: keyLoading } = useQuery<ApiKeyData>({
    queryKey: ["admin-sync-key"],
    queryFn: () => apiFetch("/api/admin/sync/key"),
  });

  const { data: cacheStatus, isLoading: cacheLoading } = useQuery<CacheStatus>({
    queryKey: ["currency-cache-status"],
    queryFn: () => apiFetch("/api/admin/currencies/cache-status"),
    refetchInterval: 30_000,
  });

  const { data: currencies = [], isLoading: currenciesLoading } = useQuery<CurrencyRow[]>({
    queryKey: ["admin-currencies"],
    queryFn: () => apiFetch("/api/admin/currencies"),
  });

  // ── Rotate key mutation ─────────────────────────────────────────────────────
  const rotateMutation = useMutation({
    mutationFn: () => apiFetch("/api/admin/sync/rotate-key", { method: "POST" }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["admin-sync-key"] });
      setShowKey(true);
      toast({ title: "API key rotated", description: "Update your website configuration with the new key." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // ── Refresh rates mutation ──────────────────────────────────────────────────
  const refreshMutation = useMutation({
    mutationFn: () => apiFetch("/api/admin/currencies/refresh-rates", { method: "POST" }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["currency-cache-status"] });
      qc.invalidateQueries({ queryKey: ["admin-currencies"] });
      toast({ title: "Rates refreshed", description: `${data.updated ?? 0} currencies updated from live exchange API.` });
    },
    onError: (err: any) => {
      toast({ title: "Refresh failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Sync test ───────────────────────────────────────────────────────────────
  async function testSync() {
    if (!keyData?.apiKey) {
      toast({ title: "No API key configured", description: "Generate a key first.", variant: "destructive" });
      return;
    }
    setSyncTesting(true);
    setSyncResult(null);
    const start = Date.now();
    try {
      const [plans, extensions, currenciesRes] = await Promise.all([
        fetch("/api/sync/plans?currency=USD", { headers: { "X-System-API-Key": keyData.apiKey } }).then(r => r.json()),
        fetch("/api/sync/domain-extensions?currency=USD", { headers: { "X-System-API-Key": keyData.apiKey } }).then(r => r.json()),
        fetch("/api/sync/currencies", { headers: { "X-System-API-Key": keyData.apiKey } }).then(r => r.json()),
      ]);
      const latencyMs = Date.now() - start;
      setSyncResult({
        ok: true,
        plans: plans?.plans?.length ?? 0,
        extensions: extensions?.extensions?.length ?? 0,
        currencies: Array.isArray(currenciesRes) ? currenciesRes.length : 0,
        latencyMs,
      });
    } catch (err: any) {
      setSyncResult({ ok: false, error: err.message, latencyMs: Date.now() - start });
    }
    setSyncTesting(false);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const webhookUrl = `${window.location.origin.replace(/:\d+$/, "")}/api/webhooks/safepay`;
  const mainKey = currencies.filter(c => ["USD", "GBP", "EUR"].includes(c.code));

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API &amp; Integration Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage the Parda sync key, exchange rate cache, and external webhook configuration.
        </p>
      </div>

      {/* ── System API Key ────────────────────────────────────────────────────── */}
      <Card
        title="System API Key (Parda)"
        icon={Key}
        badge={keyData ? <StatusPill ok={keyData.configured} label={keyData.configured ? "Configured" : "Not set"} /> : null}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            This key secures the <strong className="text-gray-700">/api/sync/*</strong> endpoints.
            Your website must send it in the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">X-System-API-Key</code> header
            to pull hosting plans, domain pricing, and currencies.
          </p>

          {keyLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : (
            <div className="space-y-3">
              {/* Key display */}
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showKey ? "text" : "password"}
                    readOnly
                    value={keyData?.apiKey ?? ""}
                    placeholder={keyData?.configured ? "••••••••••••••••••••••••••••••••" : "No key generated yet"}
                    className="w-full h-10 px-3 pr-10 rounded-lg border border-gray-200 bg-gray-50 font-mono text-xs text-gray-700 outline-none"
                  />
                  <button
                    onClick={() => setShowKey(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    {showKey ? "hide" : "show"}
                  </button>
                </div>
                {keyData?.apiKey && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copy(keyData.apiKey!, "api-key")}
                    className="shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    {copied === "api-key" ? "Copied!" : "Copy"}
                  </Button>
                )}
              </div>

              {/* Usage example */}
              {keyData?.configured && (
                <div className="bg-gray-900 rounded-lg px-4 py-3 font-mono text-xs text-emerald-400 leading-relaxed overflow-x-auto whitespace-pre">
{`curl -H "X-System-API-Key: <your-key>" \\
  ${window.location.origin}/api/sync/plans?currency=USD`}
                </div>
              )}

              {/* Rotate key */}
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1 text-xs text-amber-700">
                  Rotating the key immediately invalidates the old one. Update your website's environment variable after rotating.
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-200 text-amber-700 hover:bg-amber-100 shrink-0"
                  onClick={() => {
                    if (!window.confirm("Rotate API key? The old key will stop working immediately.")) return;
                    rotateMutation.mutate();
                  }}
                  disabled={rotateMutation.isPending}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  {rotateMutation.isPending ? "Rotating…" : "Rotate Key"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Exchange Rate Status ──────────────────────────────────────────────── */}
      <Card
        title="Google Exchange Rate Status"
        icon={TrendingUp}
        badge={
          cacheStatus ? (
            <StatusPill ok={cacheStatus.cacheFresh} label={cacheStatus.cacheFresh ? "Cache fresh" : "Stale"} />
          ) : null
        }
      >
        <div className="space-y-4">
          {/* Cache timing */}
          {cacheLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Last Updated</div>
                <div className="mt-1 text-sm font-semibold text-gray-800">
                  {cacheStatus?.lastRefreshed
                    ? new Date(cacheStatus.lastRefreshed).toLocaleString()
                    : "Never"}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Cache Age</div>
                <div className="mt-1 text-sm font-semibold text-gray-800">
                  {cacheStatus?.ageHours !== null && cacheStatus?.ageHours !== undefined
                    ? `${cacheStatus.ageHours}h`
                    : "—"}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Next Auto-Refresh</div>
                <div className="mt-1 text-sm font-semibold text-gray-800">
                  {cacheStatus
                    ? `${cacheStatus.nextRefreshInHours}h`
                    : "—"}
                </div>
              </div>
            </div>
          )}

          {/* Key currency rates */}
          {currenciesLoading ? null : (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Current Rates (from PKR base)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {currencies.filter(c => c.isActive).map(c => (
                  <div key={c.code} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-xs font-bold text-gray-700">{c.code}</span>
                      <span className="text-[10px] text-gray-400 ml-1">{c.symbol}</span>
                    </div>
                    <span className="text-xs font-mono font-semibold text-gray-800">
                      {Number(c.exchangeRate).toFixed(5)}
                    </span>
                    {c.isDefault && (
                      <span className="ml-1 text-[9px] px-1 bg-violet-100 text-violet-600 rounded font-semibold">BASE</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              style={{ background: BRAND, color: "#fff" }}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              {refreshMutation.isPending ? "Refreshing…" : "Force Refresh Rates"}
            </Button>
            <p className="text-xs text-gray-400">Rates are auto-refreshed every 24 hours from <strong>open.er-api.com</strong>.</p>
          </div>
        </div>
      </Card>

      {/* ── Webhook URL ───────────────────────────────────────────────────────── */}
      <Card title="Safepay Webhook URL" icon={Webhook}>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Configure this URL in your Safepay dashboard under <strong className="text-gray-700">Webhook Settings</strong>.
            Safepay will POST payment notifications to this endpoint.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 font-mono text-xs text-gray-700 overflow-x-auto whitespace-nowrap">
              {window.location.origin.replace("23274", "8080").replace(/^https?:\/\/[^/]+/, `https://api.noehost.com`)}/api/webhooks/safepay
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(
                `https://api.noehost.com/api/webhooks/safepay`,
                "webhook"
              )}
            >
              <Copy className="w-3.5 h-3.5 mr-1" />
              {copied === "webhook" ? "Copied!" : "Copy"}
            </Button>
          </div>
          <div className="flex items-start gap-2 text-xs text-gray-400">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              HMAC-SHA256 signature verification is active. Requests without a valid <code className="bg-gray-100 px-1 rounded">X-SFPY-SIGNATURE</code> are rejected.
            </span>
          </div>
        </div>
      </Card>

      {/* ── Sync Status ───────────────────────────────────────────────────────── */}
      <Card
        title="Sync Status (Parda Test)"
        icon={Globe}
        badge={
          syncResult
            ? <StatusPill ok={syncResult.ok} label={syncResult.ok ? "Connected" : "Failed"} />
            : null
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Tests that the <strong className="text-gray-700">/api/sync/*</strong> endpoints are reachable and returning data correctly.
            Your external website calls these to pull live pricing.
          </p>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-gray-400 mb-1">Plans</div>
              <div className="font-bold text-gray-700 text-lg">{syncResult?.ok ? syncResult.plans : "—"}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-gray-400 mb-1">TLDs</div>
              <div className="font-bold text-gray-700 text-lg">{syncResult?.ok ? syncResult.extensions : "—"}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-gray-400 mb-1">Currencies</div>
              <div className="font-bold text-gray-700 text-lg">{syncResult?.ok ? syncResult.currencies : "—"}</div>
            </div>
          </div>

          {syncResult?.ok && syncResult.latencyMs !== undefined && (
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <Wifi className="w-3.5 h-3.5" />
              <span>All sync endpoints healthy — response in <strong>{syncResult.latencyMs}ms</strong></span>
            </div>
          )}

          {syncResult && !syncResult.ok && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span>{syncResult.error ?? "Sync test failed"}</span>
            </div>
          )}

          <Button
            size="sm"
            onClick={testSync}
            disabled={syncTesting || !keyData?.configured}
            variant={syncResult?.ok ? "outline" : "default"}
            style={!syncResult?.ok ? { background: BRAND, color: "#fff" } : undefined}
          >
            {syncTesting
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Testing…</>
              : <><ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> {syncResult ? "Re-test" : "Run Sync Test"}</>
            }
          </Button>

          {!keyData?.configured && (
            <p className="text-xs text-amber-500">Generate an API key first to enable sync testing.</p>
          )}

          {/* Sync endpoint reference */}
          <div className="border-t border-gray-100 pt-4 space-y-2">
            <p className="text-xs font-medium text-gray-500">Sync Endpoints</p>
            {[
              { method: "GET", path: "/api/sync/plans?currency=USD", desc: "Hosting plans with prices" },
              { method: "GET", path: "/api/sync/domain-extensions?currency=USD", desc: "Domain TLD pricing" },
              { method: "GET", path: "/api/sync/currencies", desc: "Active currencies & rates" },
              { method: "GET", path: "/api/global/config", desc: "IP-detected currency + all rates (no key required)" },
            ].map(ep => (
              <div key={ep.path} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded font-mono font-bold">{ep.method}</span>
                <code className="text-gray-600 font-mono">{ep.path}</code>
                <span className="text-gray-400 shrink-0">— {ep.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
