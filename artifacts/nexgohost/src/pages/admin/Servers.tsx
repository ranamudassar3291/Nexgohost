import { useState } from "react";
import { motion } from "framer-motion";
import { Server, Plus, Pencil, Trash2, Shield, Loader2, Layers, CheckCircle, XCircle, Wifi, Package, ShieldCheck } from "lucide-react";
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
}
interface TwentyIPkg { id: string; name: string; }

const EMPTY_SERVER = { name: "", hostname: "", ipAddress: "", type: "cpanel", apiUsername: "", apiToken: "", apiPort: "2087", ns1: "", ns2: "", maxAccounts: "500", groupId: "" };
const EMPTY_GROUP = { name: "", description: "" };

const TYPE_LABELS: Record<string, string> = { cpanel: "cPanel", directadmin: "DirectAdmin", plesk: "Plesk", "20i": "20i", none: "None" };
const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
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
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string; packages?: string[] }>>({});
  const [whitelisting, setWhitelisting] = useState<string | null>(null);
  const [whitelistResults, setWhitelistResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  // 20i in-form test state
  const [testingForm, setTestingForm] = useState(false);
  const [formTestResult, setFormTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
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

  const resetFormState = () => {
    setShowServerForm(false); setEditServerId(null); setServerForm(EMPTY_SERVER);
    setIsDefault(false); setApiTokenSaved(false);
    setFormTestResult(null); setTwentyiPkgs([]); setTwentyiDefaultPkg("");
  };

  // ── In-form 20i connection test ──────────────────────────────────────────
  const handleFormTest = async () => {
    if (!serverForm.apiToken) { toast({ title: "Enter your 20i API Key first", variant: "destructive" }); return; }
    setTestingForm(true); setFormTestResult(null); setTwentyiPkgs([]);
    try {
      const result = await apiFetch("/api/admin/servers/test-api-key", {
        method: "POST",
        body: JSON.stringify({ apiKey: serverForm.apiToken, type: "20i" }),
      });
      setFormTestResult({ ok: true, msg: result.message });
      if (result.packages && result.packages.length > 0) {
        setTwentyiPkgs(result.packages);
        if (!twentyiDefaultPkg) setTwentyiDefaultPkg(result.packages[0].id);
      }
      toast({ title: "Connection successful", description: result.message });
    } catch (err: any) {
      setFormTestResult({ ok: false, msg: err.message });
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    } finally { setTestingForm(false); }
  };

  // ── Save server ──────────────────────────────────────────────────────────
  const handleSaveServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverForm.name) { toast({ title: "Server name is required", variant: "destructive" }); return; }
    if (is20i) {
      if (!serverForm.apiToken && !apiTokenSaved) {
        toast({ title: "API Key is required", description: "Enter your 20i API Key and test the connection.", variant: "destructive" }); return;
      }
    } else {
      if (!serverForm.hostname) { toast({ title: "Hostname is required", variant: "destructive" }); return; }
    }
    setSaving(true);
    try {
      const body = {
        ...serverForm,
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
      setTestResults(r => ({ ...r, [id]: { ok: true, msg: result.message, packages: result.packages || [] } }));
      const pkgSuffix = result.packages?.length ? ` — ${result.packages.length} package(s) found` : "";
      toast({ title: "Server Connected", description: result.message + pkgSuffix });
    } catch (err: any) {
      setTestResults(r => ({ ...r, [id]: { ok: false, msg: err.message, packages: [] } }));
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
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
                  <div className="border border-violet-500/20 rounded-xl p-4 space-y-4 bg-violet-500/5">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-md bg-violet-500/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-violet-400">20</span>
                      </div>
                      <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">20i Reseller API</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">API Key *</label>
                      <Input
                        type="password"
                        value={serverForm.apiToken}
                        onChange={e => { setS("apiToken")(e); setFormTestResult(null); }}
                        placeholder={apiTokenSaved ? "Key saved — enter new to replace" : "Paste your 20i reseller API key"}
                      />
                      {editServerId && apiTokenSaved && !serverForm.apiToken && (
                        <p className="text-xs text-emerald-400">✓ API key is saved — leave blank to keep existing</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Find your API key in{" "}
                        <a href="https://my.20i.com/reseller/api-key" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
                          my.20i.com → API Key
                        </a>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                      onClick={handleFormTest}
                      disabled={testingForm || (!serverForm.apiToken && apiTokenSaved)}
                    >
                      {testingForm ? <Loader2 size={14} className="animate-spin mr-2" /> : <Wifi size={14} className="mr-2" />}
                      {testingForm ? "Testing…" : "Test Connection"}
                    </Button>
                    {formTestResult && (
                      <div className={`flex items-start gap-2 text-xs p-3 rounded-lg border ${formTestResult.ok ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : "border-red-500/20 bg-red-500/5 text-red-400"}`}>
                        {formTestResult.ok ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <XCircle size={13} className="mt-0.5 shrink-0" />}
                        <span>{formTestResult.msg}</span>
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
                          {twentyiPkgs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                          {s.type !== "20i" && s.maxAccounts && <span className="text-xs text-muted-foreground">Max: {s.maxAccounts} accts</span>}
                          {s.hasApiToken && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle size={10} /> API key set</span>}
                        </div>
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
