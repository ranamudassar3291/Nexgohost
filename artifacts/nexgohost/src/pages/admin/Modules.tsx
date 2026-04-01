import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Server, ExternalLink, CheckCircle, Upload, Package, CreditCard,
  Zap, Trash2, Settings, ChevronDown, ChevronUp, AlertCircle,
  Eye, EyeOff, ToggleLeft, ToggleRight, RefreshCw, X, Globe,
  Wifi, WifiOff, Key, Shield, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const BRAND = "#4F46E5";

// ── API helpers ───────────────────────────────────────────────────────────────
function getToken(): string {
  return localStorage.getItem("token") || "";
}

async function apiFetch(url: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(url, {
    credentials: "include",
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "checkbox" | "textarea";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  description?: string;
}

interface UploadedModule {
  id: string;
  name: string;
  slug: string;
  type: "server" | "gateway" | "registrar";
  version: string;
  description: string;
  configFields: ConfigField[];
  config: Record<string, string>;
  hooks: string[];
  isActive: boolean;
  status: "active" | "inactive" | "error";
  uploadedAt: string;
}

// ── Built-in modules (static display) ────────────────────────────────────────
const BUILTIN = [
  {
    id: "20i", name: "20i", type: "server",
    description: "UK-based web hosting reseller platform with full API integration.",
    logo: "20i", color: "from-violet-500/20 to-violet-600/10",
    badge: "bg-violet-500/10 text-violet-500 border-violet-500/20",
    features: ["Automated account creation", "Suspend / unsuspend via API", "Let's Encrypt SSL", "Fetch packages from portal", "StackCP login link", "Full provisioning on order"],
    docsUrl: "https://my.20i.com/reseller/apidoc", status: "active",
  },
  {
    id: "cpanel", name: "cPanel / WHM", type: "server",
    description: "Industry-standard web hosting control panel — create, suspend, terminate accounts via WHM API.",
    logo: "cP", color: "from-orange-500/20 to-orange-600/10",
    badge: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    features: ["Automated account provisioning", "SSO login", "Suspend / unsuspend", "SSL automation", "Disk usage monitoring", "MySQL database management"],
    docsUrl: "https://docs.cpanel.net/", status: "active",
  },
  {
    id: "directadmin", name: "DirectAdmin", type: "server",
    description: "Lightweight hosting control panel — full lifecycle management via API.",
    logo: "DA", color: "from-blue-500/20 to-blue-600/10",
    badge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    features: ["Account create / delete", "Bandwidth monitoring", "Domain management", "FTP control", "Database management"],
    docsUrl: "https://directadmin.com/api.php", status: "available",
  },
  {
    id: "stripe", name: "Stripe", type: "gateway",
    description: "Global card payments gateway — publishable + secret key integration.",
    logo: "S", color: "from-indigo-500/20 to-indigo-600/10",
    badge: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    features: ["Card payments (Visa/MC/Amex)", "Sandbox test mode", "Webhook support", "Refund processing"],
    docsUrl: "https://stripe.com/docs", status: "active",
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfigFieldInput({
  field, value, onChange,
}: { field: ConfigField; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);

  if (field.type === "password") {
    return (
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder ?? `Enter ${field.label}`}
          className="pr-10 rounded-xl text-sm"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <Textarea
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder ?? `Enter ${field.label}`}
        rows={3}
        className="rounded-xl text-sm resize-none"
      />
    );
  }
  if (field.type === "select" && field.options) {
    return (
      <select
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value="">Select…</option>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return (
    <Input
      type="text"
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder ?? `Enter ${field.label}`}
      className="rounded-xl text-sm"
    />
  );
}

function UploadedModuleCard({ mod, onRefresh }: { mod: UploadedModule; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>(mod.config ?? {});
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(mod.name);
  const [renameSaving, setRenameSaving] = useState(false);
  const { toast } = useToast();

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === mod.name) { setRenaming(false); return; }
    setRenameSaving(true);
    try {
      await apiFetch(`/api/admin/modules/${mod.id}/meta`, {
        method: "PUT",
        body: JSON.stringify({ name: newName.trim() }),
      });
      toast({ title: "Module renamed", description: `Now showing as "${newName.trim()}"` });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Rename failed", description: err.message, variant: "destructive" });
    } finally {
      setRenameSaving(false);
      setRenaming(false);
    }
  };

  // Save config — activate=true forces active, activate=undefined preserves current state
  const handleSave = async (activate?: boolean) => {
    setSaving(true);
    try {
      const body: any = { config };
      if (activate !== undefined) body.activate = activate;
      await apiFetch(`/api/admin/modules/${mod.id}/config`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      toast({
        title: activate ? "Saved & Activated!" : "Configuration saved",
        description: activate
          ? `${mod.name} is now active and live.`
          : `Config saved. Module status unchanged.`,
      });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const [forceActivating, setForceActivating] = useState(false);
  const handleForceActivate = async () => {
    setForceActivating(true);
    try {
      await apiFetch(`/api/admin/modules/${mod.id}/force-activate`, { method: "POST" });
      toast({ title: "Force Activated!", description: `${mod.name} is now active — no validation checks applied.` });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Force activate failed", description: err.message, variant: "destructive" });
    } finally {
      setForceActivating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete module "${mod.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/admin/modules/${mod.id}`, { method: "DELETE" });
      toast({ title: "Module deleted", description: mod.name });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const typeIcon = mod.type === "server" ? <Server size={15} /> : mod.type === "registrar" ? <Globe size={15} /> : <CreditCard size={15} />;
  const isActive = mod.isActive;

  const is20i = mod.name.toLowerCase().includes("20i") || mod.description?.toLowerCase().includes("20i");

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden transition-all ${isActive ? "border-primary/40 shadow-sm shadow-primary/10" : "border-border"}`}>
      <div className="p-5 flex items-start gap-4">
        {/* Icon — branded for 20i, generic for others */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black ${
          is20i
            ? "bg-gradient-to-br from-violet-500/20 to-violet-600/10 text-violet-600 border border-violet-500/20"
            : isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}>
          {is20i ? "20i" : <Package size={22} />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            {renaming ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
                  className="text-sm font-bold border border-primary/40 rounded-lg px-2 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 w-44"
                />
                <button onClick={handleRename} disabled={renameSaving} className="text-xs text-primary font-semibold hover:underline">
                  {renameSaving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setRenaming(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            ) : (
              <span
                className="font-bold text-foreground text-[15px] cursor-pointer hover:text-primary transition-colors group"
                title="Click to rename"
                onClick={() => setRenaming(true)}
              >
                {mod.name}
                <span className="ml-1 opacity-0 group-hover:opacity-60 text-xs font-normal">(rename)</span>
              </span>
            )}
            <span className="text-[11px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1
              bg-muted text-muted-foreground border-border">
              {typeIcon}
              {mod.type === "server" ? "Server Module" : "Payment Gateway"}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
              isActive
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
            }`}>
              {isActive ? <><CheckCircle size={10} /> Active</> : "Inactive"}
            </span>
            <span className="text-[10px] text-muted-foreground">v{mod.version}</span>
          </div>
          {mod.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{mod.description}</p>
          )}
          {mod.hooks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {mod.hooks.map(h => (
                <span key={h} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/5 text-primary border border-primary/10 font-medium flex items-center gap-1">
                  <Zap size={9} />{h}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            title={isActive ? "Active — click Settings to configure" : "Inactive — open Settings and click Save & Activate"}
            className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${isActive ? "bg-green-500/10 text-green-600 border-green-500/30" : "bg-muted text-muted-foreground border-border"}`}
          >
            {isActive ? "Active" : "Inactive"}
          </span>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Configure"
          >
            <Settings size={17} />
          </button>
          <button
            onClick={handleDelete}
            className="text-muted-foreground hover:text-red-500 transition-colors"
            title="Delete module"
          >
            <Trash2 size={16} />
          </button>
          <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded config panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-5 py-5 bg-muted/30">
              {mod.configFields.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No configuration fields defined for this module.</p>
              ) : (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Module Configuration
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {mod.configFields.map(field => (
                      <div key={field.key}>
                        <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1">
                          {field.label}
                          {field.required && <span className="text-red-500">*</span>}
                        </Label>
                        {field.description && (
                          <p className="text-[10px] text-muted-foreground mb-1">{field.description}</p>
                        )}
                        <ConfigFieldInput
                          field={field}
                          value={config[field.key] ?? ""}
                          onChange={v => setConfig(c => ({ ...c, [field.key]: v }))}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-5">
                    <Button
                      size="sm"
                      onClick={() => handleSave(true)}
                      disabled={saving || forceActivating}
                      style={{ background: BRAND }}
                      className="text-white rounded-xl"
                    >
                      {saving ? <RefreshCw size={13} className="animate-spin mr-1.5" /> : <Zap size={13} className="mr-1.5" />}
                      Save & Activate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSave()}
                      disabled={saving || forceActivating}
                      className="rounded-xl"
                    >
                      Save Config
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleForceActivate}
                      disabled={saving || forceActivating}
                      className="rounded-xl border-green-500/40 text-green-700 hover:bg-green-500/10"
                    >
                      {forceActivating ? <RefreshCw size={13} className="animate-spin mr-1.5" /> : <CheckCircle size={13} className="mr-1.5" />}
                      Force Activate
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    <strong>Save Config</strong> preserves current active/inactive state. &nbsp;
                    <strong>Save & Activate</strong> saves and immediately enables the module. &nbsp;
                    <strong>Force Activate</strong> bypasses all checks.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UploadZone({ onSuccess }: { onSuccess: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ module: UploadedModule; message: string; detected: boolean; sqlResult?: { ran: boolean; statements: number; error?: string }; hooksRegistered?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Please upload a .zip file.");
      return;
    }
    setError(null);
    setResult(null);
    setUploading(true);

    try {
      const form = new FormData();
      form.append("module", file);
      const token = getToken();
      const res = await fetch("/api/admin/modules/upload", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setResult(data);
      toast({ title: "Module installed!", description: data.message });
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }, [onSuccess, toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          dragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={e => e.target.files?.[0] && processFile(e.target.files[0])}
        />
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <RefreshCw size={36} className="animate-spin text-primary" />
          ) : (
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${BRAND}15` }}>
              <Upload size={28} style={{ color: BRAND }} />
            </div>
          )}
          <div>
            <p className="font-bold text-foreground text-[15px]">
              {uploading ? "Installing module…" : dragging ? "Drop to install" : "Upload Module (.zip)"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {uploading ? "Extracting and detecting configuration…" : "Drag & drop or click to browse — max 10 MB"}
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800/40">
          <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Success result */}
      {result && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800/30 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{result.message}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <span className="text-muted-foreground">Module name</span>
            <span className="font-semibold text-foreground">{result.module.name}</span>
            <span className="text-muted-foreground">Type</span>
            <span className="font-semibold text-foreground capitalize">{result.module.type}</span>
            <span className="text-muted-foreground">Version</span>
            <span className="font-semibold text-foreground">{result.module.version}</span>
            <span className="text-muted-foreground">Config fields</span>
            <span className="font-semibold text-foreground">{result.module.configFields.length}</span>
            {/* SQL result row */}
            <span className="text-muted-foreground">SQL migration</span>
            <span className={`font-semibold ${result.sqlResult?.ran ? "text-emerald-600" : "text-muted-foreground"}`}>
              {result.sqlResult?.ran
                ? `✓ ${result.sqlResult.statements} statement${result.sqlResult.statements === 1 ? "" : "s"} executed`
                : result.sqlResult?.error
                  ? `⚠ ${result.sqlResult.error}`
                  : "No install.sql found"}
            </span>
            {/* Hooks row */}
            <span className="text-muted-foreground">Hooks registered</span>
            <span className={`font-semibold ${(result.hooksRegistered?.length ?? 0) > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
              {(result.hooksRegistered?.length ?? 0) > 0
                ? result.hooksRegistered!.join(", ")
                : "None detected"}
            </span>
          </div>
          {!result.detected && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle size={11} />
              No <code className="font-mono">module.json</code> found — default fields were used. Please review and configure below.
            </p>
          )}
          {result.sqlResult?.error && (
            <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertCircle size={11} />
              SQL error: {result.sqlResult.error}. Module installed but schema migration failed — run install.sql manually.
            </p>
          )}
        </div>
      )}

      {/* Module spec hint */}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground transition-colors font-medium">
          Module .zip format specification
        </summary>
        <div className="mt-2 p-3.5 rounded-xl bg-muted/50 font-mono text-[11px] space-y-1 border border-border">
          <p className="text-foreground font-semibold mb-2">Recommended structure:</p>
          <p>my-module.zip/</p>
          <p className="pl-4 text-primary">├── module.json  <span className="text-muted-foreground">(type, name, configFields)</span></p>
          <p className="pl-4 text-amber-500">├── install.sql  <span className="text-muted-foreground">(auto-executed on install)</span></p>
          <p className="pl-4 text-violet-400">├── hooks.php    <span className="text-muted-foreground">(hooks auto-registered)</span></p>
          <p className="pl-4">└── index.js     <span className="text-muted-foreground">(main module logic)</span></p>
          <p className="text-foreground font-semibold mt-3 mb-2">module.json structure:</p>
          <pre className="whitespace-pre-wrap">{`{
  "name": "MyGateway",
  "type": "gateway",
  "version": "1.0.0",
  "description": "…",
  "configFields": [
    {
      "key": "api_key",
      "label": "API Key",
      "type": "password",
      "required": true
    }
  ],
  "hooks": ["onActivate", "onSuspend"]
}`}</pre>
        </div>
      </details>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Modules() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"upload" | "uploaded" | "builtin">("upload");
  const queryClient = useQueryClient();

  const { data: uploadedMods = [], refetch } = useQuery<UploadedModule[]>({
    queryKey: ["admin-modules-uploaded"],
    queryFn: () => apiFetch("/api/admin/modules/uploaded"),
  });

  const { data: twentyiServer, refetch: refetchTwentyi, isFetching: ti_fetching } = useQuery<any>({
    queryKey: ["admin-twentyi-server-status"],
    queryFn: () => apiFetch("/api/admin/twenty-i/server"),
    retry: false,
    staleTime: 30_000,
  });

  const [ti_testResult, setTiTestResult] = useState<any>(null);
  const [ti_testing, setTiTesting] = useState(false);

  // Server outbound IP detection
  const [serverIp, setServerIp] = useState<{ primary: string | null; secondary: string | null } | null>(null);
  const [ipLoading, setIpLoading] = useState(false);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  async function detectServerIp() {
    setIpLoading(true);
    try {
      const result = await apiFetch("/api/system/ip");
      if (result?.primary || result?.secondary) {
        setServerIp({ primary: result.primary, secondary: result.secondary });
      }
    } catch { /* non-critical */ } finally {
      setIpLoading(false);
    }
  }

  // Auto-detect on mount
  useEffect(() => { detectServerIp(); }, []);

  function copyIp(ip: string) {
    navigator.clipboard.writeText(ip).catch(() => {});
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  }

  async function handleTest20i() {
    setTiTesting(true);
    setTiTestResult(null);
    // Re-detect IP in parallel with starting the test (backend also detects, but this keeps UI in sync)
    detectServerIp();
    try {
      const result = await apiFetch("/api/20i/test", { method: "POST", body: JSON.stringify({}) });
      setTiTestResult(result);
      // Prefer IPs returned from the test (they were detected server-side just before the call)
      if (result?.outboundIp?.primary || result?.outboundIp?.secondary) {
        setServerIp(result.outboundIp);
      }
    } catch (err: any) {
      setTiTestResult({ success: false, message: err.message });
    } finally {
      setTiTesting(false);
    }
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-modules-uploaded"] });
    refetch();
  };

  const tabs = [
    { id: "upload",   label: "Upload Module",    icon: Upload },
    { id: "uploaded", label: `Installed (${uploadedMods.length})`, icon: Package },
    { id: "builtin",  label: "Built-in Modules",  icon: Server },
  ] as const;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Module Manager</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Upload server & gateway modules to extend Noehost capabilities dynamically
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation("/admin/servers")} className="rounded-xl">
            <Server size={15} className="mr-2" /> Servers
          </Button>
          <Button variant="outline" onClick={() => setLocation("/admin/payment-methods")} className="rounded-xl">
            <CreditCard size={15} className="mr-2" /> Gateways
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground/70 flex items-start gap-3">
        <Zap size={16} className="text-primary mt-0.5 flex-shrink-0" />
        <span>
          Upload any server or payment gateway module as a <strong>.zip</strong> file. The system auto-detects its configuration fields from <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">module.json</code>.
          Configure and activate — it becomes available system-wide instantly.
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {tab === "upload" && (
          <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${BRAND}18` }}>
                  <Upload size={16} style={{ color: BRAND }} />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-[15px]">Upload Module (.zip)</h2>
                  <p className="text-xs text-muted-foreground">Auto-extracts, detects config, and registers immediately</p>
                </div>
              </div>
              <UploadZone onSuccess={() => { handleRefresh(); setTab("uploaded"); }} />
            </div>
          </motion.div>
        )}

        {tab === "uploaded" && (
          <motion.div key="uploaded" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {uploadedMods.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-10 text-center">
                <Package size={40} className="text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-foreground font-semibold">No modules installed yet</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Upload a .zip module to get started</p>
                <Button onClick={() => setTab("upload")} style={{ background: BRAND }} className="text-white rounded-xl">
                  <Upload size={15} className="mr-2" /> Upload Your First Module
                </Button>
              </div>
            ) : (
              uploadedMods.map(mod => (
                <UploadedModuleCard key={mod.id} mod={mod} onRefresh={handleRefresh} />
              ))
            )}
          </motion.div>
        )}

        {tab === "builtin" && (
          <motion.div key="builtin" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-5">
            {BUILTIN.map(mod => (
              <div key={mod.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className={`bg-gradient-to-r ${mod.color} p-5 flex items-start gap-4`}>
                  <div className="w-12 h-12 rounded-xl bg-background/80 flex items-center justify-center text-base font-black text-foreground shadow-sm flex-shrink-0">
                    {mod.logo}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                      <h2 className="text-[15px] font-bold text-foreground">{mod.name}</h2>
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium ${mod.badge}`}>
                        {mod.status === "active" ? "Integrated" : "Available"}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border font-medium">
                        {mod.type === "server" ? "Server Module" : "Payment Gateway"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{mod.description}</p>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">Supported Functions</p>
                  <div className="grid grid-cols-2 gap-1.5 mb-4">
                    {mod.features.map(f => (
                      <div key={f} className="flex items-center gap-1.5 text-xs text-foreground/80">
                        <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2.5">
                    <Button
                      size="sm"
                      onClick={() => setLocation(mod.type === "server" ? "/admin/servers" : "/admin/payment-methods")}
                      style={{ background: BRAND }}
                      className="text-white rounded-xl"
                    >
                      <Settings size={13} className="mr-1.5" />
                      Configure {mod.name}
                    </Button>
                    <a href={mod.docsUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="rounded-xl">
                        <ExternalLink size={13} className="mr-1.5" /> API Docs
                      </Button>
                    </a>
                  </div>

                  {/* Live connection status — only for 20i */}
                  {mod.id === "20i" && (
                    <div className="mt-4 border-t border-border pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Connection Status</p>
                        <button
                          onClick={() => refetchTwentyi()}
                          disabled={ti_fetching}
                          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        >
                          <RefreshCw size={11} className={ti_fetching ? "animate-spin" : ""} />
                          Refresh
                        </button>
                      </div>

                      {/* Server config row */}
                      {ti_fetching ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <RefreshCw size={12} className="animate-spin" /> Checking server…
                        </div>
                      ) : twentyiServer?.connected ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Server</span>
                            <div className="flex items-center gap-1.5">
                              <Wifi size={13} className="text-emerald-500" />
                              <span className="text-xs font-semibold text-emerald-600">{twentyiServer.name ?? "Configured"}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">API Key</span>
                            <div className="flex items-center gap-1.5">
                              <Key size={12} className="text-primary" />
                              <span className="text-xs font-mono font-semibold text-foreground">
                                {twentyiServer.apiTokenMasked ?? <span className="text-muted-foreground italic">Not set</span>}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <WifiOff size={12} className="text-red-400" />
                          No 20i server configured — click <strong className="text-foreground">Configure 20i</strong> above to add your API key.
                        </div>
                      )}

                      {/* ── Detected Server IP ──────────────────────────── */}
                      <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Globe size={11} /> Detected Server IP
                          </span>
                          <button
                            onClick={detectServerIp}
                            disabled={ipLoading}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                          >
                            <RefreshCw size={10} className={ipLoading ? "animate-spin" : ""} /> Refresh
                          </button>
                        </div>

                        {ipLoading && !serverIp ? (
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <RefreshCw size={11} className="animate-spin" /> Detecting…
                          </div>
                        ) : serverIp ? (
                          <div className="space-y-1.5">
                            {[
                              { label: "Primary (ipify.org)", ip: serverIp.primary },
                              { label: "Secondary (ifconfig.me)", ip: serverIp.secondary },
                            ].map(({ label, ip }) =>
                              ip ? (
                                <div key={label} className="flex items-center justify-between gap-2">
                                  <div>
                                    <div className="text-[10px] text-muted-foreground">{label}</div>
                                    <div className="font-mono text-sm font-bold text-foreground">{ip}</div>
                                  </div>
                                  <button
                                    onClick={() => copyIp(ip)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-border bg-background hover:bg-muted transition-colors"
                                  >
                                    {copiedIp === ip ? (
                                      <><Check size={11} className="text-green-500" /> Copied!</>
                                    ) : (
                                      <><Copy size={11} /> Copy IP</>
                                    )}
                                  </button>
                                </div>
                              ) : null
                            )}
                            <p className="text-[10px] text-muted-foreground pt-0.5">
                              Add this IP to <strong>my.20i.com → Reseller API → IP Whitelist</strong> before testing.
                            </p>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">Could not detect server IP — check network access.</div>
                        )}
                      </div>

                      {/* ── Live API Test Button ─────────────────────────── */}
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={handleTest20i}
                          disabled={ti_testing}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 border"
                          style={{
                            background: ti_testResult?.success ? "#10b98115" : ti_testResult === null ? `${BRAND}12` : "#ef444415",
                            borderColor: ti_testResult?.success ? "#10b981" : ti_testResult === null ? BRAND : "#ef4444",
                            color: ti_testResult?.success ? "#059669" : ti_testResult === null ? BRAND : "#dc2626",
                          }}
                        >
                          {ti_testing ? (
                            <><RefreshCw size={12} className="animate-spin" /> Testing…</>
                          ) : ti_testResult?.success ? (
                            <><CheckCircle size={12} /> {ti_testResult.httpStatus ?? 200} OK — Connected!</>
                          ) : ti_testResult ? (
                            <><AlertCircle size={12} /> {ti_testResult.httpStatus ?? "ERR"} — {ti_testResult.errorType === "ip_not_whitelisted" ? "IP Not Whitelisted" : ti_testResult.httpStatus === 403 ? "Key Rejected" : "Failed"}</>
                          ) : (
                            <><Zap size={12} /> Test Connection (api.20i.com)</>
                          )}
                        </button>
                        {ti_testResult && (
                          <button
                            onClick={() => { setTiTestResult(null); }}
                            className="text-muted-foreground hover:text-foreground"
                            title="Dismiss"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      {/* ── Test Result: Success ─────────────────────────── */}
                      {ti_testResult?.success && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40 text-xs text-green-700 dark:text-green-300">
                          <CheckCircle size={12} className="shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <div className="font-semibold">Connected successfully</div>
                            <div className="text-[11px] font-mono opacity-75">{ti_testResult.workingUrl}</div>
                            {ti_testResult.keySource && (
                              <div className="text-[10px] opacity-60">Key source: {ti_testResult.keySource}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ── Test Result: IP Not Whitelisted ─────────────── */}
                      {ti_testResult && !ti_testResult.success && ti_testResult.errorType === "ip_not_whitelisted" && (
                        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/25 p-3 space-y-2 text-xs">
                          <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                            <Shield size={13} /> IP Not Whitelisted (401)
                          </div>
                          <p className="text-amber-700 dark:text-amber-400">
                            20i rejected this server's IP. Add it to the whitelist at{" "}
                            <a href="https://my.20i.com" target="_blank" rel="noreferrer" className="underline font-semibold">
                              my.20i.com → Reseller API → IP Whitelist
                            </a>
                            , then click <strong>Retry</strong>.
                          </p>
                          {(serverIp?.primary || serverIp?.secondary) && (
                            <div className="flex flex-wrap gap-2">
                              {[serverIp.primary, serverIp.secondary].filter(Boolean).map(ip => (
                                <button
                                  key={ip}
                                  onClick={() => copyIp(ip!)}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border border-amber-400 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 transition-colors"
                                >
                                  {copiedIp === ip ? <Check size={11} /> : <Copy size={11} />}
                                  {ip}
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={handleTest20i}
                            disabled={ti_testing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-amber-400 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-800/50 text-amber-900 dark:text-amber-200 disabled:opacity-50 transition-colors"
                          >
                            <RefreshCw size={11} className={ti_testing ? "animate-spin" : ""} /> Retry Connection
                          </button>
                        </div>
                      )}

                      {/* ── Test Result: Other Error ─────────────────────── */}
                      {ti_testResult && !ti_testResult.success && ti_testResult.errorType !== "ip_not_whitelisted" && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 text-xs text-red-800 dark:text-red-300">
                          <AlertCircle size={12} className="shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <div className="font-semibold">{ti_testResult.message}</div>
                            {ti_testResult.hint && (
                              <div className="text-[11px] opacity-80">{ti_testResult.hint}</div>
                            )}
                            {ti_testResult.keySource && (
                              <div className="text-[10px] opacity-60">Key source: {ti_testResult.keySource}</div>
                            )}
                            {ti_testResult.attempts?.length > 0 && (
                              <div className="mt-1 space-y-0.5 font-mono text-[10px] opacity-60">
                                {(ti_testResult.attempts as any[]).map((a: any, i: number) => (
                                  <div key={i}>[{a.httpStatus ?? "ERR"}] {a.url} ({a.durationMs}ms)</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
