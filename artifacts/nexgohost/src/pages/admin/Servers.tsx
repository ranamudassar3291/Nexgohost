import { useState } from "react";
import { motion } from "framer-motion";
import { Server, Plus, Pencil, Trash2, Shield, Loader2, Layers, CheckCircle, XCircle, Wifi, Package, ShieldCheck, HardDrive, Users2, Zap, RotateCcw, Globe, AlertTriangle, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers } });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
  return res.json();
}

interface ServerGroup { id: string; name: string; description: string | null; }
interface ServerRecord {
  id: string; name: string; hostname: string; ipAddress: string | null;
  type: "cpanel" | "directadmin" | "plesk" | "20i" | "none";
  apiUsername: string | null; apiPort: number | null;
  ns1: string | null; ns2: string | null; maxAccounts: number | null;
  status: "active" | "inactive" | "maintenance"; groupId: string | null; isDefault: boolean;
  hasApiToken?: boolean;
  keyType?: string;
  accountCount?: number;
}
interface TwentyIPkg { id: string; label: string; name?: string; }

// For 20i servers: the combinedKey field holds the full key string exactly as pasted.
// Format: "GeneralKey+OAuthClientKey"  (e.g. "cb574b954e850f7f5+c6e95e89ebd7ea3c0")
// This string is stored as-is in the database (TEXT column, no length limit, + preserved).
const EMPTY_SERVER = {
  name: "", hostname: "", ipAddress: "", type: "cpanel",
  apiUsername: "", apiToken: "",
  combinedKey: "",  // 20i: paste the FULL key here (GeneralKey+OAuthKey or just GeneralKey)
  keyType: "combined",
  proxyUrl: "", apiPort: "2087", ns1: "", ns2: "", maxAccounts: "500", groupId: "",
};
const EMPTY_GROUP = { name: "", description: "" };

/** One-click "Add current IP to 20i whitelist" — shown in the 20i server edit form */
function AutoWhitelistBtn({ serverId }: { serverId: string }) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const handleSync = async () => {
    setSyncing(true); setResult(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/twenty-i/whitelist/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      setResult(data);
      if (data.success) toast({ title: `✓ IP ${data.outboundIp} added to 20i whitelist` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSyncing(false); }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50 shadow-sm w-full justify-center"
      >
        {syncing ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
        {syncing ? "Syncing IP to 20i Whitelist…" : "Auto-Add Current IP to 20i Whitelist"}
      </button>
      {result && (
        <div className={`text-xs rounded-lg px-3 py-2 border ${result.success ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600" : result.error === "auth_failed" ? "bg-amber-500/5 border-amber-500/20 text-amber-700" : "bg-primary/5 border-primary/20 text-primary"}`}>
          {result.success
            ? result.alreadyPresent
              ? `✓ IP ${result.outboundIp} is already in 20i's whitelist — no action needed.`
              : `✓ IP ${result.outboundIp} added to 20i whitelist.`
            : result.error === "chicken_and_egg"
              ? `IP ${result.outboundIp} is blocked — add it manually once at my.20i.com → Reseller API → IP Whitelist, then retry.`
              : result.error === "auth_failed"
                ? `API key authentication failed. Re-check the key in Admin → Servers.`
                : `Failed: ${result.error ?? result.message}`}
        </div>
      )}
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = { cpanel: "cPanel", directadmin: "DirectAdmin", plesk: "Plesk", "20i": "20i", none: "None" };
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  inactive: "bg-secondary text-muted-foreground border-border",
  maintenance: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
};

export default function Servers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"servers" | "groups">("servers");

  // Server state
  const [showServerForm, setShowServerForm] = useState(false);
  const [editServerId, setEditServerId] = useState<string | null>(null);
  const [serverForm, setServerForm] = useState(EMPTY_SERVER);
  const [isDefault, setIsDefault] = useState(false);
  const [apiTokenSaved, setApiTokenSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string; packages?: string[]; permissions?: { name: string; api: string; ok: boolean; reason: string }[] }>>({});
  const [whitelisting, setWhitelisting] = useState<string | null>(null);
  const [whitelistResults, setWhitelistResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  // 20i in-form test state
  const [testingForm, setTestingForm] = useState(false);
  const [formTestResult, setFormTestResult] = useState<{ ok: boolean; msg: string; diagnostic?: { step?: string; endpoint?: string; detail?: string } | null } | null>(null);
  const [debugInfo, setDebugInfo] = useState<any | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [twentyiPkgs, setTwentyiPkgs] = useState<TwentyIPkg[]>([]);
  const [twentyiDefaultPkg, setTwentyiDefaultPkg] = useState("");

  // Group state
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP);
  const [savingGroup, setSavingGroup] = useState(false);

  const { data: servers = [], isLoading: loadingServers } = useQuery<ServerRecord[]>({
    queryKey: ["admin-servers"], queryFn: () => apiFetch("/api/admin/servers"),
  });
  const { data: groups = [], isLoading: loadingGroups } = useQuery<ServerGroup[]>({
    queryKey: ["admin-server-groups"], queryFn: () => apiFetch("/api/admin/server-groups"),
  });

  const setS = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setServerForm(s => ({ ...s, [f]: e.target.value }));

  const is20i = serverForm.type === "20i";

  // Outbound IP — fetched lazily when 20i form is shown (must be after is20i is defined)
  const { data: outboundData, isLoading: loadingIp } = useQuery<{ ip: string; proxy: { enabled: boolean; url?: string } }>({
    queryKey: ["outbound-ip"],
    queryFn: () => apiFetch(`/api/admin/servers/outbound-ip?nocache=${Date.now()}`),
    enabled: showServerForm && is20i,
    staleTime: 0,
    retry: false,
  });

  const resetFormState = () => {
    setShowServerForm(false); setEditServerId(null); setServerForm(EMPTY_SERVER);
    setIsDefault(false); setApiTokenSaved(false);
    setFormTestResult(null); setDebugInfo(null); setShowDebug(false);
    setTwentyiPkgs([]); setTwentyiDefaultPkg("");
  };

  // ── In-form 20i connection test ──────────────────────────────────────────
  const handleFormTest = async () => {
    // Use the combinedKey field directly — the user pastes the full string (GeneralKey+OAuthKey)
    const keyToTest = serverForm.combinedKey.trim();
    if (!keyToTest) {
      toast({ title: "Paste your 20i API key first" });
      return;
    }
    setTestingForm(true); setFormTestResult(null); setDebugInfo(null); setShowDebug(false); setTwentyiPkgs([]);
    try {
      const result = await apiFetch("/api/admin/servers/test-api-key", {
        method: "POST",
        body: JSON.stringify({
          apiKey: keyToTest,        // full string, no modification — e.g. "cb57…+c6e9…"
          type: "20i",
          keyType: "combined",
          proxyUrl: serverForm.ipAddress || undefined,
        }),
      });
      if (result.debug) { setDebugInfo(result.debug); setShowDebug(true); }
      if (!result.success) {
        setFormTestResult({ ok: false, msg: result.message, diagnostic: result.diagnostic });
        return;
      }
      setFormTestResult({ ok: true, msg: result.message, diagnostic: result.diagnostic });
      if (result.packages?.length > 0) {
        setTwentyiPkgs(result.packages);
        if (!twentyiDefaultPkg) setTwentyiDefaultPkg(result.packages[0].id);
      }
      toast({ title: "Connection successful", description: result.message });
    } catch (err: any) {
      setFormTestResult({ ok: false, msg: err.message });
    } finally { setTestingForm(false); }
  };

  // ── Save server ──────────────────────────────────────────────────────────
  const handleSaveServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverForm.name) { toast({ title: "Server name is required", variant: "destructive" }); return; }

    // For 20i: use the combinedKey field directly as the stored token
    // The user pastes the full string: "GeneralKey+OAuthKey" or just "GeneralKey"
    // It goes into the database as-is (TEXT column, no limit, + preserved)
    let resolvedApiToken = serverForm.apiToken;
    let resolvedKeyType = serverForm.keyType;
    if (is20i) {
      const key = serverForm.combinedKey.trim();
      if (key) {
        resolvedApiToken = key;
        resolvedKeyType = "combined";
      }
      if (!resolvedApiToken && !apiTokenSaved) {
        toast({ title: "API Key is required", description: "Paste your full 20i key (GeneralKey+OAuthKey).", variant: "destructive" });
        return;
      }
    } else {
      if (!serverForm.hostname) { toast({ title: "Hostname is required", variant: "destructive" }); return; }
    }

    setSaving(true);
    try {
      const body = {
        ...serverForm,
        apiToken: resolvedApiToken,
        keyType: resolvedKeyType,
        hostname: is20i ? "api.20i.com" : serverForm.hostname,
        apiUsername: is20i ? null : (serverForm.apiUsername || null),
        apiPort: is20i ? null : parseInt(serverForm.apiPort),
        isDefault,
        ...(is20i && twentyiDefaultPkg ? { defaultPackageId: twentyiDefaultPkg } : {}),
      };
      if (editServerId) {
        await apiFetch(`/api/admin/servers/${editServerId}`, { method: "PUT", body: JSON.stringify(body) });
        toast({ title: "Server updated" });
      } else {
        await apiFetch("/api/admin/servers", { method: "POST", body: JSON.stringify(body) });
        toast({ title: "Server added" });
      }
      qc.invalidateQueries({ queryKey: ["admin-servers"] });
      resetFormState();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ── Post-save test (from server card) ───────────────────────────────────
  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const result = await apiFetch(`/api/admin/servers/${id}/test`, { method: "POST" });
      const isOk = result.success !== false && result.connected !== false;
      setTestResults(r => ({ ...r, [id]: { ok: isOk, msg: result.message, packages: result.packages || [], permissions: result.permissions || [], diagnostic: result.diagnostic } }));
      if (isOk) {
        const pkgSuffix = result.packages?.length ? ` — ${result.packages.length} package(s) found` : "";
        toast({ title: "Server Connected", description: result.message + pkgSuffix });
      } else {
        toast({ title: "Connection issue", description: result.diagnostic?.detail || result.message });
      }
    } catch (err: any) {
      setTestResults(r => ({ ...r, [id]: { ok: false, msg: err.message, packages: [], permissions: [] } }));
      toast({ title: "Connection failed", description: err.message });
    } finally { setTesting(null); }
  };

  const handleWhitelistSelf = async (id: string) => {
    setWhitelisting(id);
    try {
      const result = await apiFetch(`/api/admin/servers/${id}/whitelist-self`, { method: "POST" });
      setWhitelistResults(r => ({ ...r, [id]: { ok: true, msg: result.message || `IP ${result.ip} whitelisted` } }));
      toast({ title: "Firewall Whitelisted", description: result.message || `${result.ip} added to CSF whitelist` });
    } catch (err: any) {
      setWhitelistResults(r => ({ ...r, [id]: { ok: false, msg: err.message } }));
      toast({ title: "Whitelist failed", description: err.message, variant: "destructive" });
    } finally { setWhitelisting(null); }
  };

  const handleDeleteServer = async (id: string) => {
    if (!confirm("Delete this server?")) return;
    try {
      await apiFetch(`/api/admin/servers/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["admin-servers"] });
      toast({ title: "Server deleted" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name) { toast({ title: "Group name required", variant: "destructive" }); return; }
    setSavingGroup(true);
    try {
      if (editGroupId) {
        await apiFetch(`/api/admin/server-groups/${editGroupId}`, { method: "PUT", body: JSON.stringify(groupForm) });
        toast({ title: "Group updated" });
      } else {
        await apiFetch("/api/admin/server-groups", { method: "POST", body: JSON.stringify(groupForm) });
        toast({ title: "Group created" });
      }
      qc.invalidateQueries({ queryKey: ["admin-server-groups"] });
      setShowGroupForm(false); setEditGroupId(null); setGroupForm(EMPTY_GROUP);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSavingGroup(false); }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("Delete this group? Servers in this group will be ungrouped.")) return;
    try {
      await apiFetch(`/api/admin/server-groups/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["admin-server-groups"] });
      toast({ title: "Group deleted" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const groupMap = Object.fromEntries(groups.map(g => [g.id, g.name]));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Servers</h1>
          <p className="text-muted-foreground text-sm">Manage hosting servers, groups, and module integrations</p>
        </div>
        <Button onClick={() => activeTab === "servers"
          ? (resetFormState(), setShowServerForm(true))
          : (setEditGroupId(null), setGroupForm(EMPTY_GROUP), setShowGroupForm(true))}
          className="bg-primary hover:bg-primary/90">
          <Plus size={16} className="mr-2" /> {activeTab === "servers" ? "Add Server" : "Add Group"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 border border-border rounded-xl p-1 w-fit">
        {[{ key: "servers", icon: Server, label: "Servers" }, { key: "groups", icon: Layers, label: "Server Groups" }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Servers Tab ── */}
      {activeTab === "servers" && (
        <>
          {showServerForm && (
            <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><Server size={18} className="text-primary" /></div>
                <div>
                  <h2 className="font-semibold">{editServerId ? "Edit Server" : "Add Server"}</h2>
                  <p className="text-xs text-muted-foreground">Configure connection and API credentials</p>
                </div>
              </div>
              <form onSubmit={handleSaveServer} className="space-y-4">

                {/* Common: Name + Module Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground/80">Server Name *</label>
                    <Input value={serverForm.name} onChange={setS("name")} placeholder={is20i ? "20i Reseller" : "US Server 01"} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground/80">Module Type</label>
                    <select value={serverForm.type} onChange={e => { setS("type")(e); setFormTestResult(null); setTwentyiPkgs([]); setTwentyiDefaultPkg(""); }}
                      className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="cpanel">cPanel / WHM</option>
                      <option value="directadmin">DirectAdmin</option>
                      <option value="plesk">Plesk</option>
                      <option value="20i">20i</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>

                {/* ── 20i-specific fields ── */}
                {is20i && (
                  <div className="border border-primary/20 rounded-xl p-4 space-y-4 bg-primary/5">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">20</span>
                      </div>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider">20i Reseller API</p>
                    </div>

                    {/* ── IP Whitelist Info ── */}
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                        <p className="text-xs font-semibold text-amber-600">IP Whitelist Required</p>
                      </div>

                      {/* Current outbound IP */}
                      <div className="flex items-center justify-between gap-2 bg-card/80 border border-border/40 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Panel Outbound IP</p>
                          <p className="font-mono text-sm font-semibold text-foreground">
                            {loadingIp ? "Detecting…" : (outboundData?.ip ?? "unknown")}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          {!loadingIp && outboundData?.ip && outboundData.ip !== "unknown" && (
                            <button
                              type="button"
                              onClick={() => { navigator.clipboard.writeText(outboundData.ip); toast({ title: "IP copied to clipboard" }); }}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-border bg-secondary/60 hover:bg-secondary transition-colors text-muted-foreground"
                            >
                              <Copy size={11} />
                              Copy
                            </button>
                          )}
                          <a
                            href="https://my.20i.com/reseller/api-key"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-primary"
                          >
                            <ExternalLink size={11} />
                            Whitelist
                          </a>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Add the IP above to{" "}
                        <a href="https://my.20i.com/reseller/api-key" target="_blank" rel="noreferrer" className="underline text-primary">
                          my.20i.com → Reseller API → IP Whitelist
                        </a>
                        . Once whitelisted, click Test Connection.
                      </p>

                      {/* Auto-whitelist button — only show when we have a saved server */}
                      {editServerId && (
                        <AutoWhitelistBtn serverId={editServerId} />
                      )}
                    </div>

                    {/* ── Proxy URL field — optional, for stable IP routing ── */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground/80">Static IP Proxy URL</label>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-medium">Recommended — fixes IP changes</span>
                      </div>
                      <Input
                        value={serverForm.proxyUrl}
                        onChange={setS("proxyUrl")}
                        placeholder="http://noehost.com:3128"
                        className="font-mono text-sm"
                      />
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-muted-foreground space-y-1.5">
                        <p className="font-semibold text-emerald-700">Permanent fix for changing IPs</p>
                        <p>
                          If your server at <strong>noehost.com</strong> is already whitelisted in 20i, route all API calls through it as a proxy.
                          Install <strong>Squid</strong> or <strong>Tinyproxy</strong> on your server and enter the URL here (e.g. <code className="font-mono text-primary">http://noehost.com:3128</code>).
                        </p>
                        <p>Once set, 20i will always see your server's stable IP — no more manual whitelisting.</p>
                      </div>
                    </div>

                    {/* ── Single API Key field ── */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground/80">
                        20i API Key <span className="text-primary">*</span>
                      </label>
                      <Input
                        type="password"
                        value={serverForm.combinedKey}
                        onChange={e => { setServerForm(s => ({ ...s, combinedKey: e.target.value })); setFormTestResult(null); }}
                        placeholder={apiTokenSaved ? "Key saved — paste new to replace" : "Paste your full 20i key here"}
                        className="font-mono"
                      />
                      {editServerId && apiTokenSaved && !serverForm.combinedKey && (
                        <p className="text-xs text-emerald-600">✓ Key saved — leave blank to keep existing</p>
                      )}
                      <div className="rounded-lg border border-primary/10 bg-primary/5 px-3 py-2 text-xs text-muted-foreground space-y-1">
                        <p className="font-semibold text-foreground/70">Where to find your key — <a href="https://my.20i.com/reseller/api-key" target="_blank" rel="noreferrer" className="text-primary underline">my.20i.com → Reseller API</a>:</p>
                        <ul className="space-y-0.5 ml-2 list-disc">
                          <li><strong>General Key</strong>: paste it as-is (e.g. <code className="font-mono text-primary">cb574b954e850f7f5</code>)</li>
                          <li><strong>Combined Key</strong>: paste the full string — the General Key is extracted automatically (e.g. <code className="font-mono text-primary">cb574b954e850f7f5+c6e95e89ebd7ea3c0</code>)</li>
                        </ul>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-primary/30 text-primary hover:bg-primary/10"
                      onClick={handleFormTest}
                      disabled={testingForm || (!serverForm.combinedKey && apiTokenSaved)}
                    >
                      {testingForm ? <Loader2 size={14} className="animate-spin mr-2" /> : <Wifi size={14} className="mr-2" />}
                      {testingForm ? "Testing…" : "Test Connection"}
                    </Button>

                    {/* Test result */}
                    {formTestResult && (
                      <div className={`text-xs p-3 rounded-xl border space-y-2 ${
                        formTestResult.ok
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : "border-red-400/30 bg-red-500/5"
                      }`}>
                        {formTestResult.ok ? (
                          <div className="flex items-start gap-2 font-medium text-emerald-500">
                            <CheckCircle size={13} className="mt-0.5 shrink-0" />
                            <span>{formTestResult.msg}</span>
                          </div>
                        ) : (() => {
                          const msg = formTestResult.msg ?? "";
                          const isWrongKey = msg.includes("KEY NOT RECOGNISED") || msg.includes('"type":"User ID"') || msg.includes("User ID");
                          const isIpBlocked = msg.includes("IP NOT WHITELISTED") || msg.includes("ip_blocked");
                          return (
                            <div className="space-y-2">
                              <div className="flex items-start gap-2 font-semibold text-red-600">
                                <XCircle size={13} className="mt-0.5 shrink-0" />
                                <span>
                                  {isWrongKey
                                    ? "Invalid API Key — 20i does not recognise this key"
                                    : isIpBlocked
                                    ? "IP Not Whitelisted — add this server's IP in 20i"
                                    : "Connection failed"}
                                </span>
                              </div>
                              {isWrongKey && (
                                <div className="ml-5 space-y-1 text-muted-foreground">
                                  <p>The key you entered was rejected by 20i with error <code className="font-mono text-red-500">&#123;"type":"User ID"&#125;</code> — meaning the key does not match any account on their system.</p>
                                  <p className="font-medium text-foreground/80 mt-1.5">Steps to fix:</p>
                                  <ol className="ml-3 list-decimal space-y-0.5">
                                    <li>Open <a href="https://my.20i.com/reseller/api-key" target="_blank" rel="noreferrer" className="text-primary underline">my.20i.com → Reseller API → API Keys</a></li>
                                    <li>Copy your <strong>General API Key</strong> exactly as shown</li>
                                    <li>Paste it in the field above and click <strong>Test Connection</strong></li>
                                  </ol>
                                </div>
                              )}
                              {isIpBlocked && (
                                <p className="ml-5 text-muted-foreground">Add this server's outbound IP to the whitelist at my.20i.com → Reseller API → IP Whitelist, then test again.</p>
                              )}
                              {!isWrongKey && !isIpBlocked && (
                                <p className="ml-5 text-muted-foreground">{msg}</p>
                              )}
                            </div>
                          );
                        })()}
                        {formTestResult.ok && formTestResult.diagnostic?.endpoint && (
                          <p className="text-muted-foreground pl-[19px]">Endpoint: <span className="font-mono">{formTestResult.diagnostic.endpoint}</span></p>
                        )}
                      </div>
                    )}

                    {/* Live Debug Log */}
                    {debugInfo && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowDebug(v => !v)}
                          className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Zap size={12} />
                            Live Debug Log
                          </span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${debugInfo.workingFormat !== "none" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-red-400/30 bg-red-500/10 text-red-500"}`}>
                            {debugInfo.workingFormat !== "none" ? `✓ Connected (${debugInfo.workingFormat})` : `HTTP ${debugInfo.responseStatus ?? "ERR"}`}
                          </span>
                        </button>
                        {showDebug && (
                          <div className="border-t border-primary/10 text-xs font-mono">
                            {/* Wrong API key banner */}
                            {debugInfo.diagnosis === "wrong_key" && (
                              <div className="px-3.5 py-3 bg-red-500/8 border-b border-red-500/20 space-y-2.5">
                                <p className="text-red-600 font-semibold text-[11px]">KEY NOT RECOGNISED — 20i rejected this key as invalid</p>
                                <div className="rounded-lg bg-background border border-red-400/20 px-3 py-2 text-[10px] font-sans text-muted-foreground">
                                  <p className="font-semibold text-foreground/80 mb-1">What this error means:</p>
                                  <p>20i returned <code className="font-mono text-red-600">&#123;"type":"User ID"&#125;</code> — this is their specific error for <strong>"key not found in our system"</strong>. It is not an IP whitelist issue. The key string you entered does not match any 20i reseller account.</p>
                                </div>
                                <div className="text-[10px] font-sans text-muted-foreground space-y-1.5">
                                  <p className="font-semibold text-foreground/80">How to get the correct key:</p>
                                  <ol className="space-y-1 ml-3 list-decimal">
                                    <li>Open <a href="https://my.20i.com/reseller/api-key" target="_blank" rel="noreferrer" className="text-primary underline font-semibold">my.20i.com → Reseller API → API Keys</a></li>
                                    <li>Find <strong>"General API Key"</strong> — copy it exactly (no spaces)</li>
                                    <li>Optionally, also copy <strong>"Combined Key"</strong> and paste the full string including the <code className="font-mono">+</code></li>
                                    <li>Paste into the "20i API Key" field above and click <strong>Test Connection</strong></li>
                                  </ol>
                                </div>
                                <div className="rounded-lg bg-amber-500/8 border border-amber-400/20 px-3 py-2 text-[10px] font-sans">
                                  <p className="font-semibold text-amber-700 mb-0.5">Also whitelist your current outbound IP:</p>
                                  <p className="text-muted-foreground">Your panel's outbound IP is <code className="font-mono font-bold text-foreground">{debugInfo.outboundIp}</code>. Add it at <a href="https://my.20i.com/reseller/api-key" target="_blank" rel="noreferrer" className="text-primary underline">my.20i.com → Reseller API → IP Whitelist</a>, then test again.</p>
                                </div>
                              </div>
                            )}
                            {/* IP not whitelisted banner */}
                            {debugInfo.diagnosis === "ip_blocked" && (
                              <div className="px-3.5 py-3 bg-amber-500/8 border-b border-amber-500/20">
                                <p className="text-amber-700 font-semibold text-[11px] mb-2">ACTION REQUIRED — Whitelist this IP in 20i:</p>
                                <div className="flex items-center gap-2 mb-2">
                                  <code className="font-mono text-sm font-bold text-foreground bg-background border border-border rounded px-2 py-1">{debugInfo.outboundIp}</code>
                                  <button
                                    type="button"
                                    onClick={() => { navigator.clipboard.writeText(debugInfo.outboundIp ?? ""); }}
                                    className="text-[10px] px-2 py-1 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-semibold"
                                  >
                                    Copy
                                  </button>
                                  <a
                                    href="https://my.20i.com/reseller/api"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] px-2 py-1 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-semibold"
                                  >
                                    Open my.20i.com
                                  </a>
                                </div>
                                <ol className="text-[10px] text-muted-foreground space-y-0.5 list-decimal ml-3">
                                  <li>Go to <strong>my.20i.com → Reseller API</strong></li>
                                  <li>Find <strong>IP Whitelist</strong> section</li>
                                  <li>Add <strong>{debugInfo.outboundIp}</strong> and save</li>
                                  <li>Come back and click <strong>Test Connection</strong> again</li>
                                </ol>
                              </div>
                            )}
                            {/* Summary rows */}
                            {(() => {
                              const gkLen = debugInfo.generalKeyLength ?? debugInfo.keyLength;
                              const combined = debugInfo.isCombined;
                              const keyLabel = combined
                                ? `${debugInfo.keyLength} chars total · General Key: ${gkLen} chars · first: ${debugInfo.keyFirst4}… last: …${debugInfo.keyLast4}${debugInfo.keyHasHiddenChars ? " ⚠ hidden chars stripped" : ""}`
                                : `${gkLen} chars · first: ${debugInfo.keyFirst4}… last: …${debugInfo.keyLast4}${debugInfo.keyHasHiddenChars ? " ⚠ hidden chars stripped" : ""}`;
                              const authLabel = `Bearer <base64(${gkLen}-char ${combined ? "general key, extracted from combined" : "key"})>  →  ${debugInfo.tokenLength ?? "?"} chars total`;
                              return [
                                ["Endpoint", `${debugInfo.method} ${debugInfo.url}`],
                                ["Key length", keyLabel],
                                ["Auth header", authLabel],
                                ["Outbound IP", debugInfo.outboundIp + (debugInfo.proxyActive ? ` (via proxy)` : " (direct — whitelist this IP in 20i)")],
                                ["HTTP status", `${debugInfo.responseStatus ?? "ERR"} in ${debugInfo.durationMs}ms`],
                              ].map(([label, value]) => (
                                <div key={label} className="flex gap-3 px-3.5 py-1.5 border-b border-primary/10">
                                  <span className="text-muted-foreground w-28 shrink-0 font-sans">{label}</span>
                                  <span className="text-foreground/80 break-all">{value}</span>
                                </div>
                              ));
                            })()}
                            {/* Per-attempt breakdown */}
                            {Array.isArray(debugInfo.attempts) && debugInfo.attempts.map((a: any) => {
                              // 200 = success. 404 = auth passed (no data). Both are "connected".
                              const authPassed = a.status === 200 || a.status === 404;
                              return (
                                <div key={a.format} className={`border-b border-primary/10 ${authPassed ? "bg-emerald-500/5" : "bg-red-500/5"}`}>
                                  <div className="flex gap-3 px-3.5 py-1.5">
                                    <span className="text-muted-foreground w-32 shrink-0">Attempt ({a.format})</span>
                                    <span className={`break-all ${authPassed ? "text-emerald-600" : "text-red-500"}`}>
                                      {a.authHeaderPreview} → HTTP {a.status ?? "ERR"} · {a.durationMs}ms
                                      {a.status === 200 ? " ✓ CONNECTED" : a.status === 404 ? " ✓ AUTH OK (no packages yet)" : " ✗ FAILED"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                            {/* Full raw 20i response body — shown always so the user can see exactly what 20i says */}
                            <div className={`px-3.5 py-2.5 ${debugInfo.workingFormat === "none" ? "bg-red-500/5 border-t border-red-500/15" : ""}`}>
                              <span className={`font-sans text-[11px] font-semibold block mb-1.5 ${debugInfo.workingFormat === "none" ? "text-red-600" : "text-muted-foreground"}`}>
                                {debugInfo.workingFormat === "none" ? "Full Raw Error from 20i:" : "Raw 20i Response:"}
                              </span>
                              <pre className="text-foreground/80 whitespace-pre-wrap break-all leading-relaxed text-[11px] bg-background border border-border rounded-lg px-3 py-2">
                                {debugInfo.responseBody || "No response body received"}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {twentyiPkgs.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                          <Package size={13} className="text-violet-400" /> Default Package
                        </label>
                        <select
                          value={twentyiDefaultPkg}
                          onChange={e => setTwentyiDefaultPkg(e.target.value)}
                          className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {twentyiPkgs.map(p => <option key={p.id} value={p.id}>{p.label ?? p.name}</option>)}
                        </select>
                        <p className="text-xs text-muted-foreground">Used when provisioning new hosting accounts with no explicit plan package.</p>
                      </div>
                    )}
                  </div>
                )}

                {is20i && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">NS1</label>
                      <Input value={serverForm.ns1} onChange={setS("ns1")} placeholder="ns1.noehost.com" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">NS2</label>
                      <Input value={serverForm.ns2} onChange={setS("ns2")} placeholder="ns2.noehost.com" />
                    </div>
                  </div>
                )}

                {is20i && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground/80">Account Limit</label>
                    <Input type="number" value={serverForm.maxAccounts} onChange={setS("maxAccounts")} className="w-40" placeholder="500" />
                    <p className="text-xs text-muted-foreground">Maximum number of hosting accounts on this reseller.</p>
                  </div>
                )}

                {!is20i && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">Hostname *</label>
                      <Input value={serverForm.hostname} onChange={setS("hostname")} placeholder="server01.noehost.com" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">IP Address</label>
                      <Input value={serverForm.ipAddress} onChange={setS("ipAddress")} placeholder="192.168.1.1" />
                    </div>
                  </div>
                )}

                {!is20i && (
                  <div className="border border-border/50 rounded-xl p-4 space-y-3 bg-secondary/20">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">API Credentials</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground/80">API Username</label>
                        <Input value={serverForm.apiUsername} onChange={setS("apiUsername")} placeholder="root" />
                        <p className="text-xs text-muted-foreground">Leave as "root" for WHM API token auth</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground/80">API Token / Key</label>
                        <Input type="password" value={serverForm.apiToken} onChange={setS("apiToken")}
                          placeholder={apiTokenSaved ? "Token saved — enter new to change" : "Paste WHM API token here"} />
                        {editServerId && apiTokenSaved && !serverForm.apiToken && (
                          <p className="text-xs text-emerald-400">✓ API token is saved — leave blank to keep it</p>
                        )}
                        {editServerId && !apiTokenSaved && (
                          <p className="text-xs text-yellow-400">No token saved — enter your WHM API token</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">API Port</label>
                      <Input type="number" value={serverForm.apiPort} onChange={setS("apiPort")} className="w-32" />
                    </div>
                  </div>
                )}

                {!is20i && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><label className="text-sm font-medium text-foreground/80">NS1</label><Input value={serverForm.ns1} onChange={setS("ns1")} placeholder="ns1.noehost.com" /></div>
                    <div className="space-y-1.5"><label className="text-sm font-medium text-foreground/80">NS2</label><Input value={serverForm.ns2} onChange={setS("ns2")} placeholder="ns2.noehost.com" /></div>
                  </div>
                )}

                {!is20i && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground/80">Max Accounts</label>
                    <Input type="number" value={serverForm.maxAccounts} onChange={setS("maxAccounts")} className="w-32" />
                  </div>
                )}

                {/* Server Group */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Server Group</label>
                  <select value={serverForm.groupId} onChange={setS("groupId")} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">No Group</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="rounded" />
                  <span className="text-sm text-foreground/80">Set as default server</span>
                </label>

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
                    {saving && <Loader2 size={16} className="animate-spin mr-2" />} {editServerId ? "Save Changes" : "Add Server"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetFormState}>Cancel</Button>
                </div>
              </form>
            </div>
          )}

          {loadingServers ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary" /></div>
          ) : servers.length === 0 && !showServerForm ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
              <Server size={40} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No servers configured</h3>
              <p className="text-muted-foreground text-sm mb-4">Add a hosting server to start provisioning accounts.</p>
              <Button onClick={() => setShowServerForm(true)} className="bg-primary hover:bg-primary/90"><Plus size={16} className="mr-2" />Add First Server</Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {servers.map(s => (
                <div key={s.id} className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.status === "active" ? "bg-primary/10" : "bg-secondary"}`}>
                        {s.type === "20i"
                          ? <span className={`text-sm font-bold ${s.status === "active" ? "text-violet-400" : "text-muted-foreground"}`}>20i</span>
                          : <Server size={22} className={s.status === "active" ? "text-primary" : "text-muted-foreground"} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{s.name}</h3>
                          {s.isDefault && <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full">Default</span>}
                          <span className={`text-xs px-2 py-0.5 border rounded-full ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                          {s.groupId && groupMap[s.groupId] && (
                            <span className="text-xs px-2 py-0.5 bg-secondary text-muted-foreground border border-border rounded-full flex items-center gap-1">
                              <Layers size={10} /> {groupMap[s.groupId]}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {s.type === "20i" ? "api.20i.com (SaaS)" : `${s.hostname}${s.ipAddress ? ` · ${s.ipAddress}` : ""}`}
                        </p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground font-medium">{TYPE_LABELS[s.type]}</span>
                          {s.type !== "20i" && s.ns1 && <span className="text-xs text-muted-foreground">NS: {s.ns1}</span>}
                          {s.hasApiToken && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle size={10} /> API key set</span>}
                        </div>
                        {s.type !== "20i" && s.maxAccounts != null && (
                          <div className="mt-2 w-48">
                            {(() => {
                              const used = s.accountCount ?? 0;
                              const limit = s.maxAccounts!;
                              const pct = Math.min(100, Math.round((used / limit) * 100));
                              const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
                              return (
                                <>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-muted-foreground">Accounts</span>
                                    <span className={`text-xs font-medium ${pct >= 90 ? "text-red-400" : pct >= 70 ? "text-amber-400" : "text-emerald-400"}`}>{used} / {limit}</span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {whitelistResults[s.id] && (
                          <div className={`mt-2 flex items-center gap-1.5 text-xs ${whitelistResults[s.id].ok ? "text-emerald-400" : "text-red-400"}`}>
                            {whitelistResults[s.id].ok ? <ShieldCheck size={11} /> : <XCircle size={11} />}
                            {whitelistResults[s.id].msg}
                          </div>
                        )}
                        {testResults[s.id] && (
                          <div className="mt-2 space-y-1.5">
                            <div className={`flex items-center gap-1.5 text-xs ${testResults[s.id].ok ? "text-emerald-400" : "text-red-400"}`}>
                              {testResults[s.id].ok ? <CheckCircle size={11} /> : <XCircle size={11} />}
                              {testResults[s.id].msg}
                            </div>
                            {testResults[s.id].ok && (testResults[s.id].packages?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {testResults[s.id].packages!.map(pkg => (
                                  <span key={pkg} className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">{pkg}</span>
                                ))}
                              </div>
                            )}
                            {(testResults[s.id].permissions?.length ?? 0) > 0 && (
                              <div className="mt-1.5 pt-1.5 border-t border-border/30 space-y-0.5">
                                <p className="text-xs text-muted-foreground font-medium mb-1">API Permissions</p>
                                {testResults[s.id].permissions!.map(p => (
                                  <div key={p.api} className={`flex items-start gap-1.5 text-xs ${p.ok ? "text-emerald-400" : "text-red-400"}`}>
                                    {p.ok ? <CheckCircle size={10} className="mt-0.5 shrink-0" /> : <XCircle size={10} className="mt-0.5 shrink-0" />}
                                    <span><span className="font-medium">{p.name}:</span> {p.ok ? "OK" : p.reason}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => handleTest(s.id)} disabled={testing === s.id}>
                        {testing === s.id ? <Loader2 size={13} className="animate-spin mr-1" /> : <Shield size={13} className="mr-1" />} Test
                      </Button>
                      {(s.type === "cpanel" || s.type === "directadmin" || s.type === "plesk") && (
                        <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                          onClick={() => handleWhitelistSelf(s.id)} disabled={whitelisting === s.id}>
                          {whitelisting === s.id ? <Loader2 size={13} className="animate-spin mr-1" /> : <ShieldCheck size={13} className="mr-1" />} Whitelist IP
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => {
                        setEditServerId(s.id);
                        setApiTokenSaved(!!s.hasApiToken);
                        setFormTestResult(null); setTwentyiPkgs([]); setTwentyiDefaultPkg("");
                        setServerForm({
                          name: s.name,
                          hostname: s.type === "20i" ? "" : s.hostname,
                          ipAddress: s.ipAddress || "",
                          type: s.type,
                          apiUsername: s.apiUsername || "root",
                          apiToken: "",
                          // 20i key field — cleared on edit (key is stored server-side)
                          combinedKey: "",
                          keyType: s.keyType || "combined",
                          proxyUrl: s.proxyUrl || "",
                          apiPort: String(s.apiPort || 2087),
                          ns1: s.ns1 || "",
                          ns2: s.ns2 || "",
                          maxAccounts: String(s.maxAccounts || 500),
                          groupId: s.groupId || "",
                        });
                        setIsDefault(s.isDefault);
                        setShowServerForm(true);
                      }}><Pencil size={15} className="text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleDeleteServer(s.id)}><Trash2 size={15} className="text-destructive" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Server Groups Tab ── */}
      {activeTab === "groups" && (
        <>
          {showGroupForm && (
            <div className="bg-card border border-border rounded-2xl p-6 max-w-lg">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><Layers size={18} className="text-primary" /></div>
                <h2 className="font-semibold">{editGroupId ? "Edit Group" : "Create Server Group"}</h2>
              </div>
              <form onSubmit={handleSaveGroup} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Group Name *</label>
                  <Input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} placeholder="US East Cluster" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Description</label>
                  <Input value={groupForm.description} onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))} placeholder="Primary US East region servers" />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={savingGroup} className="bg-primary hover:bg-primary/90">
                    {savingGroup && <Loader2 size={15} className="animate-spin mr-2" />} {editGroupId ? "Save Changes" : "Create Group"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setShowGroupForm(false); setEditGroupId(null); }}>Cancel</Button>
                </div>
              </form>
            </div>
          )}

          {loadingGroups ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary" /></div>
          ) : groups.length === 0 && !showGroupForm ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
              <Layers size={40} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No server groups</h3>
              <p className="text-muted-foreground text-sm mb-4">Group servers by region or purpose. Plans can be assigned to a group for flexible provisioning.</p>
              <Button onClick={() => setShowGroupForm(true)} className="bg-primary hover:bg-primary/90"><Plus size={16} className="mr-2" />Create First Group</Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {groups.map(g => {
                const count = servers.filter(s => s.groupId === g.id).length;
                return (
                  <div key={g.id} className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Layers size={18} className="text-primary" /></div>
                        <div>
                          <h3 className="font-semibold text-foreground">{g.name}</h3>
                          {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5">{count} server{count !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { setEditGroupId(g.id); setGroupForm({ name: g.name, description: g.description || "" }); setShowGroupForm(true); }}>
                          <Pencil size={14} className="text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleDeleteGroup(g.id)}>
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {count > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                        {servers.filter(s => s.groupId === g.id).map(s => (
                          <span key={s.id} className="text-xs px-2 py-0.5 bg-secondary/70 border border-border rounded-full flex items-center gap-1">
                            <Server size={10} className="text-muted-foreground" /> {s.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
