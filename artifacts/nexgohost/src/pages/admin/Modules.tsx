import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Server, ExternalLink, CheckCircle, Upload, Package, CreditCard,
  Zap, Trash2, Settings, ChevronDown, ChevronUp, AlertCircle,
  Eye, EyeOff, ToggleLeft, ToggleRight, RefreshCw, X, Globe,
  Wifi, WifiOff, Key, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const BRAND = "#4F46E5";

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
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
  const { toast } = useToast();

  const handleSave = async (activate: boolean) => {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/modules/${mod.id}/config`, {
        method: "PUT",
        body: JSON.stringify({ config, activate }),
      });
      toast({ title: activate ? "Module activated!" : "Configuration saved", description: `${mod.name} has been ${activate ? "activated and is now live" : "updated"}.` });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    try {
      await apiFetch(`/api/admin/modules/${mod.id}/activate`, { method: "POST" });
      toast({ title: mod.isActive ? "Module deactivated" : "Module activated", description: mod.name });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden transition-all ${isActive ? "border-primary/40 shadow-sm shadow-primary/10" : "border-border"}`}>
      <div className="p-5 flex items-start gap-4">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          <Package size={22} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <span className="font-bold text-foreground text-[15px]">{mod.name}</span>
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
          <button
            onClick={handleToggle}
            title={isActive ? "Deactivate" : "Activate"}
            className={`transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            {isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
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
                  <div className="flex gap-3 mt-5">
                    <Button
                      size="sm"
                      onClick={() => handleSave(true)}
                      disabled={saving}
                      style={{ background: BRAND }}
                      className="text-white rounded-xl"
                    >
                      {saving ? <RefreshCw size={13} className="animate-spin mr-1.5" /> : <Zap size={13} className="mr-1.5" />}
                      Save & Activate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSave(false)}
                      disabled={saving}
                      className="rounded-xl"
                    >
                      Save Config Only
                    </Button>
                  </div>
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
      const res = await fetch("/api/admin/modules/upload", {
        method: "POST",
        credentials: "include",
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
                    <div className="mt-4 border-t border-border pt-4">
                      <div className="flex items-center justify-between mb-3">
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
                      {ti_fetching ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <RefreshCw size={12} className="animate-spin" /> Checking connection…
                        </div>
                      ) : twentyiServer?.connected ? (
                        <div className="grid grid-cols-2 gap-3">
                          {/* Connected badge */}
                          <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Status</span>
                            <div className="flex items-center gap-1.5">
                              <Wifi size={13} className="text-emerald-500" />
                              <span className="text-xs font-semibold text-emerald-600">Server Configured</span>
                            </div>
                          </div>
                          {/* API key */}
                          <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">API Key</span>
                            <div className="flex items-center gap-1.5">
                              <Key size={12} className="text-primary" />
                              <span className="text-xs font-mono font-semibold text-foreground">
                                {twentyiServer.apiTokenMasked ?? (
                                  <span className="text-muted-foreground italic">Not set</span>
                                )}
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
