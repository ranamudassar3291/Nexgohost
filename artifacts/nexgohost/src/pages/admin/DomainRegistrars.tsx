import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Plus, Settings, Trash2, ToggleLeft, ToggleRight,
  CheckCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp,
  Eye, EyeOff, Star, X, Zap, Mail, Server, FolderOpen, File, BadgeCheck,
  Upload, Shield, ShieldAlert, PackageOpen, Sparkles, RotateCcw,
  FileArchive, CheckCircle2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const BRAND = "#701AFE";

async function apiFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ConfigField {
  key: string; label: string; type: string;
  required?: boolean; description?: string; options?: string[];
}

interface Registrar {
  id: string; name: string; type: string; description: string;
  config: Record<string, string>; isActive: boolean; isDefault: boolean;
  fields: ConfigField[]; lastTestedAt?: string; lastTestResult?: string;
  createdAt: string;
}

// ── Registrar presets ─────────────────────────────────────────────────────────
const PRESETS = [
  {
    type: "namecheap", name: "Namecheap",
    description: "World's most popular domain registrar with a robust API for automated registration.",
    color: "from-orange-500/15 to-orange-400/5",
    badge: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    logo: "NC",
  },
  {
    type: "logicboxes", name: "LogicBoxes",
    description: "Enterprise-grade domain reseller platform used by major registrars globally.",
    color: "from-blue-500/15 to-blue-400/5",
    badge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    logo: "LB",
  },
  {
    type: "resellerclub", name: "ResellerClub",
    description: "One of the largest domain reseller networks in Asia, powered by LogicBoxes API.",
    color: "from-cyan-500/15 to-cyan-400/5",
    badge: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    logo: "RC",
  },
  {
    type: "enom", name: "eNom",
    description: "Veteran domain registrar with comprehensive bulk registration and management API.",
    color: "from-purple-500/15 to-purple-400/5",
    badge: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    logo: "EN",
  },
  {
    type: "opensrs", name: "OpenSRS",
    description: "Tucows-owned wholesale registrar with a reliable API for resellers and developers.",
    color: "from-green-500/15 to-green-400/5",
    badge: "bg-green-500/10 text-green-500 border-green-500/20",
    logo: "OS",
  },
  {
    type: "custom", name: "Custom API",
    description: "Any domain provider with a REST API. Configure the base URL, auth header, and credentials.",
    color: "from-slate-500/15 to-slate-400/5",
    badge: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    logo: "API",
  },
  {
    type: "none", name: "None / Email Only",
    description: "No API integration. Domain orders are processed manually via email notifications.",
    color: "from-muted/50 to-muted/20",
    badge: "bg-muted text-muted-foreground border-border",
    logo: "✉",
  },
];

// ── Field input ───────────────────────────────────────────────────────────────
function FieldInput({ field, value, onChange }: {
  field: ConfigField; value: string; onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  if (field.type === "password") {
    return (
      <div className="relative">
        <Input type={show ? "text" : "password"} value={value ?? ""} onChange={e => onChange(e.target.value)}
          placeholder={`Enter ${field.label}`} className="pr-10 rounded-xl text-sm" />
        <button type="button" onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    );
  }
  if (field.type === "textarea") {
    return <Textarea value={value ?? ""} onChange={e => onChange(e.target.value)}
      placeholder={`Enter ${field.label}`} rows={3} className="rounded-xl text-sm resize-none" />;
  }
  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-2 h-9">
        <input type="checkbox" id={field.key} checked={value === "true"}
          onChange={e => onChange(e.target.checked ? "true" : "false")}
          className="w-4 h-4 accent-primary" />
        <label htmlFor={field.key} className="text-sm text-muted-foreground cursor-pointer">
          Enable {field.label}
        </label>
      </div>
    );
  }
  return <Input type="text" value={value ?? ""} onChange={e => onChange(e.target.value)}
    placeholder={`Enter ${field.label}`} className="rounded-xl text-sm" />;
}

// ── ZIP Upload Modal ──────────────────────────────────────────────────────────
interface ZipUploadResult {
  name: string; description: string; phpModuleName: string | null;
  folderName: string; folderPath: string;
  configFields: ConfigField[]; hooks: string[];
  detected: boolean; securityWarnings: string[]; message: string;
}

function ZipUploadModal({
  onClose, onRegistered,
}: { onClose: () => void; onRegistered: (result: ZipUploadResult) => void }) {
  const [dragging, setDragging]     = useState(false);
  const [file, setFile]             = useState<File | null>(null);
  const [progress, setProgress]     = useState(0);
  const [uploading, setUploading]   = useState(false);
  const [result, setResult]         = useState<ZipUploadResult | null>(null);
  const [conflict, setConflict]     = useState<{ name: string } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadFile = useCallback((f: File, action?: "overwrite" | "backup") => {
    setUploading(true);
    setProgress(0);
    setError(null);
    setConflict(null);

    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("module", f);

    const url = action
      ? `/api/admin/domain-registrars/upload-module?action=${action}`
      : "/api/admin/domain-registrars/upload-module";

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      setUploading(false);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status === 409 && data.conflict) {
          setPendingFile(f);
          setConflict({ name: data.conflictName });
          return;
        }
        if (xhr.status === 422 && data.securityWarnings) {
          setError(`Security scan blocked upload:\n${data.securityWarnings.join("\n")}`);
          return;
        }
        if (xhr.status >= 400 && data.error) {
          setError(data.error);
          return;
        }
        setResult(data);
      } catch {
        setError("Invalid server response");
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setError("Upload failed — network error");
    };

    xhr.send(formData);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (!f?.name.endsWith(".zip")) { toast({ title: "Only .zip files are allowed", variant: "destructive" }); return; }
    setFile(f);
    uploadFile(f);
  }, [uploadFile, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".zip")) { toast({ title: "Only .zip files are allowed", variant: "destructive" }); return; }
    setFile(f);
    uploadFile(f);
  };

  const handleConflictAction = (action: "overwrite" | "backup") => {
    if (pendingFile) uploadFile(pendingFile, action);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border"
          style={{ background: `linear-gradient(135deg, ${BRAND}12 0%, transparent 80%)` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${BRAND}18` }}>
              <FileArchive size={17} style={{ color: BRAND }} />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-[15px]">Upload Registrar Module</h2>
              <p className="text-xs text-muted-foreground">Supports WHMCS-compatible .zip modules</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Conflict dialog */}
          {conflict && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm mb-1">
                    Module already exists: <code className="font-mono">{conflict.name}</code>
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mb-3">
                    A folder with this name already exists in <code className="font-mono">modules/registrars/</code>.
                    How do you want to proceed?
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline"
                      className="rounded-lg border-amber-400/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                      onClick={() => handleConflictAction("backup")} disabled={uploading}>
                      <RotateCcw size={12} className="mr-1.5" /> Backup & Replace
                    </Button>
                    <Button size="sm"
                      className="rounded-lg bg-red-500 hover:bg-red-600 text-white"
                      onClick={() => handleConflictAction("overwrite")} disabled={uploading}>
                      <Trash2 size={12} className="mr-1.5" /> Overwrite
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {error && !conflict && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-red-300/50 bg-red-50 dark:bg-red-950/20 p-4">
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={15} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-400 whitespace-pre-line">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Success result */}
          {result ? (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Success banner */}
              <div className="rounded-xl border border-emerald-300/40 bg-emerald-50 dark:bg-emerald-950/20 p-4 flex items-start gap-3">
                <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-sm">{result.message}</p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-0.5 font-mono">
                    {result.folderPath.split("/").slice(-3).join("/")}
                  </p>
                </div>
              </div>

              {/* Module info */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <PackageOpen size={14} style={{ color: BRAND }} />
                  <span className="font-semibold text-foreground text-sm">{result.name}</span>
                  {result.detected && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">
                      Auto-detected
                    </span>
                  )}
                </div>
                {result.description && <p className="text-xs text-muted-foreground">{result.description}</p>}

                {result.hooks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Hooks:</span>
                    {result.hooks.map(h => (
                      <span key={h} className="text-[10px] px-1.5 py-0.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded font-mono border border-violet-400/20">{h}</span>
                    ))}
                  </div>
                )}

                {/* Config fields preview */}
                {result.configFields.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Auto-generated config fields:</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {result.configFields.map(f => (
                        <div key={f.key} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: f.type === "password" ? "#ef4444" : f.type === "checkbox" ? "#10b981" : BRAND }} />
                          <span className="font-medium text-foreground">{f.label}</span>
                          {f.required && <span className="ml-auto text-red-500 text-[9px]">req.</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Security badge */}
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <Shield size={11} />
                  Security scan passed — no malicious patterns detected
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={onClose} className="rounded-xl flex-1">
                  Close
                </Button>
                <Button onClick={() => onRegistered(result)} style={{ background: BRAND }}
                  className="text-white rounded-xl flex-1 gap-2">
                  <ChevronRight size={14} /> Register as Registrar →
                </Button>
              </div>
            </motion.div>
          ) : !conflict ? (
            <>
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => !uploading && fileRef.current?.click()}
                className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer
                  ${dragging ? "border-primary bg-primary/8 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-primary/3"}
                  ${uploading ? "pointer-events-none opacity-80" : ""}
                `}
              >
                <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={handleFileChange} />
                <div className="flex flex-col items-center justify-center py-10 px-4">
                  {uploading ? (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <RefreshCw size={24} className="animate-spin" style={{ color: BRAND }} />
                      </div>
                      <p className="font-semibold text-foreground text-sm mb-1">Installing module…</p>
                      <p className="text-xs text-muted-foreground mb-4">{file?.name}</p>
                      {/* Progress bar */}
                      <div className="w-full max-w-xs h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: BRAND }}
                          animate={{ width: `${progress}%` }}
                          transition={{ type: "tween", ease: "easeOut" }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{progress}%</p>
                    </>
                  ) : (
                    <>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${dragging ? "bg-primary/15" : "bg-muted"}`}>
                        <Upload size={24} className={dragging ? "text-primary" : "text-muted-foreground"} />
                      </div>
                      <p className="font-semibold text-foreground text-sm mb-1">
                        {dragging ? "Drop to install" : "Drop your .zip here or click to browse"}
                      </p>
                      <p className="text-xs text-muted-foreground text-center max-w-xs">
                        Supports WHMCS-compatible registrar modules. The system auto-detects configuration fields from PHP source.
                      </p>
                      <div className="flex items-center gap-4 mt-5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Shield size={10} className="text-emerald-500" /> Security scan</span>
                        <span className="flex items-center gap-1"><Sparkles size={10} style={{ color: BRAND }} /> Auto-detect fields</span>
                        <span className="flex items-center gap-1"><PackageOpen size={10} /> Hook registration</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Compatible registrars note */}
              <div className="rounded-xl bg-muted/30 border border-border p-3 text-xs text-muted-foreground flex items-start gap-2">
                <CheckCircle size={12} className="mt-0.5 shrink-0 text-primary" />
                <span>
                  Compatible with any <strong>WHMCS-style</strong> registrar module (Spaceship, Ionos, Namecheap, etc.) that includes a <code className="font-mono">_getConfigArray()</code> function.
                  Custom modules with a <code className="font-mono">module.json</code> are also supported.
                </span>
              </div>
            </>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}

// ── Add Registrar Modal ───────────────────────────────────────────────────────
function AddModal({ onClose, onSaved, prefill }: { onClose: () => void; onSaved: () => void; prefill?: ZipUploadResult | null }) {
  // If pre-filling from a ZIP upload, skip the picker step and go straight to configure
  const [step, setStep] = useState<"pick" | "configure">(prefill ? "configure" : "pick");
  const [selectedType, setSelectedType] = useState(prefill ? "custom" : "");
  const [name, setName] = useState(prefill?.name ?? "");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<ConfigField[]>(prefill?.configFields ?? []);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: serverFiles, isLoading: loadingFiles } = useQuery<{ files: Array<{ name: string; path: string; size: number; isDir: boolean }> }>({
    queryKey: ["admin-module-files-registrars"],
    queryFn: () => apiFetch("/api/admin/modules/files?category=registrars"),
    enabled: showFileBrowser,
    staleTime: 30_000,
  });

  const pickPreset = async (p: typeof PRESETS[0]) => {
    setSelectedType(p.type);
    setName(p.name);
    setConfig({});
    // Fetch fields
    try {
      const data = await apiFetch(`/api/admin/domain-registrars/fields/${p.type}`);
      setFields(data.fields ?? []);
    } catch { setFields([]); }
    setStep("configure");
  };

  const handleSave = async () => {
    if (!name) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await apiFetch("/api/admin/domain-registrars", {
        method: "POST",
        body: JSON.stringify({ name, type: selectedType, config, isDefault }),
      });
      toast({ title: "Registrar added!", description: `${name} is now configured.` });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-foreground text-[16px]">
              {step === "pick" ? "Select Registrar Type" : `Configure ${name}`}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === "pick" ? "Choose the domain provider you want to connect" : "Enter your API credentials"}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {step === "pick" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {PRESETS.map(p => (
                <button key={p.type} onClick={() => pickPreset(p)}
                  className="text-left p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-sm font-bold group-hover:bg-primary/10 transition-colors">
                      {p.logo}
                    </div>
                    <span className="font-semibold text-foreground text-sm">{p.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                </button>
              ))}
            </div>
          )}

          {step === "configure" && (
            <div className="space-y-4">
              {/* ZIP-upload banner */}
              {prefill && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3">
                  <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                  <div className="text-xs text-emerald-700 dark:text-emerald-400">
                    <strong>Module uploaded</strong> — Config fields auto-generated from PHP source.
                    Installed at <code className="font-mono">{prefill.folderPath.split("/").slice(-3).join("/")}</code>.
                    {prefill.hooks.length > 0 && <> Hooks: {prefill.hooks.slice(0, 4).join(", ")}.</>}
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs font-semibold mb-1.5">Registrar Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Namecheap Production" className="rounded-xl" />
              </div>

              {fields.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map(f => (
                    <div key={f.key}>
                      <Label className="text-xs font-semibold mb-1 flex items-center gap-1">
                        {f.label}{f.required && <span className="text-red-500">*</span>}
                      </Label>
                      {f.description && <p className="text-[10px] text-muted-foreground mb-1">{f.description}</p>}
                      <FieldInput field={f} value={config[f.key] ?? ""}
                        onChange={v => setConfig(c => ({ ...c, [f.key]: v }))} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-muted/30 border border-border text-sm text-muted-foreground flex items-center gap-2">
                  <Mail size={15} />
                  This registrar requires no API credentials — domains will be processed manually via email.
                </div>
              )}

              {/* ── Server File Browser ── */}
              <div className="rounded-xl border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFileBrowser(b => !b)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
                >
                  <FolderOpen size={14} className="text-primary" />
                  Browse server module files
                  <span className="ml-auto text-[10px] text-muted-foreground">{showFileBrowser ? "▲ Hide" : "▼ Show"}</span>
                </button>
                <AnimatePresence>
                  {showFileBrowser && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border bg-muted/20 p-3">
                        {loadingFiles ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                            <RefreshCw size={12} className="animate-spin" /> Loading files…
                          </div>
                        ) : !serverFiles?.files?.length ? (
                          <p className="text-xs text-muted-foreground py-1">
                            No module files found in <code className="font-mono">modules/registrars/</code>.
                            Upload a .zip first from the Module Manager.
                          </p>
                        ) : (
                          <ul className="space-y-1 max-h-40 overflow-y-auto">
                            {serverFiles.files.map(f => (
                              <li key={f.path}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedFile(f.isDir ? null : f.path)}
                                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                                    selectedFile === f.path
                                      ? "bg-primary/10 text-primary font-semibold"
                                      : f.isDir
                                        ? "text-muted-foreground cursor-default"
                                        : "hover:bg-muted text-foreground"
                                  }`}
                                >
                                  {f.isDir
                                    ? <FolderOpen size={12} className="shrink-0 text-amber-500" />
                                    : <File size={12} className="shrink-0 text-primary/70" />
                                  }
                                  <span className="truncate">{f.path}</span>
                                  {!f.isDir && <span className="ml-auto text-muted-foreground font-mono shrink-0">
                                    {f.size > 1024 ? `${(f.size / 1024).toFixed(1)} KB` : `${f.size} B`}
                                  </span>}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {selectedFile && (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-2.5 py-1.5 border border-emerald-200 dark:border-emerald-800/40">
                            <BadgeCheck size={12} className="shrink-0" />
                            Selected: <code className="font-mono">{selectedFile}</code>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl border border-border">
                <input type="checkbox" id="isDefault" checked={isDefault} onChange={e => setIsDefault(e.target.checked)}
                  className="w-4 h-4 accent-primary" />
                <label htmlFor="isDefault" className="text-sm cursor-pointer">
                  Set as <strong>default registrar</strong> for new domain orders
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep("pick")} className="rounded-xl">← Back</Button>
                <Button onClick={handleSave} disabled={saving} style={{ background: BRAND }}
                  className="text-white rounded-xl flex-1">
                  {saving ? <RefreshCw size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
                  Add Registrar
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Registrar card ────────────────────────────────────────────────────────────
function RegistrarCard({ r, onRefresh }: { r: Registrar; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>(r.config ?? {});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const preset = PRESETS.find(p => p.type === r.type);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/domain-registrars/${r.id}`, {
        method: "PUT", body: JSON.stringify({ config }),
      });
      toast({ title: "Saved", description: `${r.name} configuration updated.` });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await apiFetch(`/api/admin/domain-registrars/${r.id}/test`, { method: "POST" });
      setTestResult({ success: data.success, message: data.message });
      onRefresh();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally { setTesting(false); }
  };

  const handleToggle = async () => {
    try {
      await apiFetch(`/api/admin/domain-registrars/${r.id}/toggle`, { method: "POST" });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSetDefault = async () => {
    try {
      await apiFetch(`/api/admin/domain-registrars/${r.id}`, {
        method: "PUT", body: JSON.stringify({ isDefault: true }),
      });
      toast({ title: "Default registrar updated", description: r.name });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete registrar "${r.name}"?`)) return;
    try {
      await apiFetch(`/api/admin/domain-registrars/${r.id}`, { method: "DELETE" });
      toast({ title: "Registrar deleted" });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden transition-all ${
      r.isActive ? "border-primary/30 shadow-sm shadow-primary/10" : "border-border"
    }`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${preset?.color ?? "from-muted/30 to-muted/10"} p-4 flex items-center gap-4`}>
        <div className="w-12 h-12 rounded-xl bg-background/90 flex items-center justify-center text-sm font-black text-foreground shadow-sm flex-shrink-0">
          {preset?.logo ?? r.type.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-bold text-foreground text-[15px]">{r.name}</span>
            {r.isDefault && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold flex items-center gap-1">
                <Star size={9} /> Default
              </span>
            )}
            {r.isActive ? (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full border font-bold flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/25">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Module Active
              </span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded-full border font-medium bg-muted text-muted-foreground border-border">
                Inactive
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{preset?.description ?? r.description}</p>
          {r.lastTestResult && (
            <p className={`text-[10px] mt-0.5 font-medium ${
              r.lastTestResult.startsWith("Connection") ? "text-emerald-500" : "text-red-500"
            }`}>
              {r.lastTestResult}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!r.isDefault && r.isActive && (
            <button onClick={handleSetDefault} title="Set as default"
              className="text-muted-foreground hover:text-amber-500 transition-colors">
              <Star size={16} />
            </button>
          )}
          <button onClick={handleToggle} title={r.isActive ? "Deactivate" : "Activate"}
            className={`transition-colors ${r.isActive ? "text-primary" : "text-muted-foreground hover:text-primary"}`}>
            {r.isActive ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
          </button>
          <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground transition-colors">
            <Settings size={16} />
          </button>
          <button onClick={handleDelete} className="text-muted-foreground hover:text-red-500 transition-colors">
            <Trash2 size={15} />
          </button>
          <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Expanded config */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="border-t border-border px-5 py-5 bg-muted/20">
              {r.fields.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/30 rounded-xl border border-border">
                  <Mail size={14} />
                  Email-only mode — no API fields to configure.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 mb-4">
                  {r.fields.map(f => (
                    <div key={f.key}>
                      <Label className="text-xs font-semibold mb-1 flex items-center gap-1">
                        {f.label}{f.required && <span className="text-red-500">*</span>}
                      </Label>
                      {f.description && <p className="text-[10px] text-muted-foreground mb-1">{f.description}</p>}
                      <FieldInput field={f} value={config[f.key] ?? ""}
                        onChange={v => setConfig(c => ({ ...c, [f.key]: v }))} />
                    </div>
                  ))}
                </div>
              )}

              {/* Test result */}
              {testResult && (
                <div className={`flex items-start gap-2 p-3 rounded-xl mb-4 text-sm border ${
                  testResult.success
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800/30 dark:text-emerald-400"
                    : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-800/30 dark:text-red-400"
                }`}>
                  {testResult.success
                    ? <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
                    : <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  }
                  {testResult.message}
                </div>
              )}

              <div className="flex gap-2.5">
                {r.fields.length > 0 && (
                  <Button size="sm" onClick={handleSave} disabled={saving}
                    style={{ background: BRAND }} className="text-white rounded-xl">
                    {saving ? <RefreshCw size={12} className="animate-spin mr-1.5" /> : null}
                    Save Config
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleTest} disabled={testing} className="rounded-xl">
                  {testing ? <RefreshCw size={12} className="animate-spin mr-1.5" /> : <Zap size={12} className="mr-1.5" />}
                  Test Connection
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DomainRegistrars() {
  const [showAdd, setShowAdd]       = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [zipPrefill, setZipPrefill] = useState<ZipUploadResult | null>(null);
  const queryClient = useQueryClient();

  const { data: registrars = [], isLoading } = useQuery<Registrar[]>({
    queryKey: ["admin-domain-registrars"],
    queryFn: () => apiFetch("/api/admin/domain-registrars"),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-domain-registrars"] });

  const handleZipRegistered = (result: ZipUploadResult) => {
    setShowUpload(false);
    setZipPrefill(result);
    setShowAdd(true);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Domain Registrars</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Connect domain providers to enable automatic registration, nameserver updates, and transfer management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowUpload(true)}
            className="rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary/5"
          >
            <Upload size={14} /> Upload Module (.zip)
          </Button>
          <Button onClick={() => { setZipPrefill(null); setShowAdd(true); }} style={{ background: BRAND }} className="text-white rounded-xl">
            <Plus size={15} className="mr-2" /> Add Registrar
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground/70 flex items-start gap-3">
        <Globe size={16} className="text-primary mt-0.5 flex-shrink-0" />
        <span>
          Configure your domain registrar API credentials here. When you <strong>Activate Domain</strong> on a pending order,
          you'll be able to select which registrar to use for live registration. The default registrar is
          pre-selected automatically.
        </span>
      </div>

      {/* How it works */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: Plus, label: "1. Add Registrar", desc: "Configure your Namecheap, LogicBoxes, or custom API credentials here." },
          { icon: Zap, label: "2. Activate Domain", desc: "On the Orders page, select this registrar when activating a pending domain order." },
          { icon: Server, label: "3. Auto Registration", desc: "Domain is registered via the API automatically. NS set to ns1/ns2.noehost.com." },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${BRAND}18` }}>
              <Icon size={15} style={{ color: BRAND }} />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Registrar list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <RefreshCw size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : registrars.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <Globe size={40} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-semibold text-foreground">No registrars configured</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Add a registrar to start automating domain registrations
          </p>
          <Button onClick={() => setShowAdd(true)} style={{ background: BRAND }} className="text-white rounded-xl">
            <Plus size={14} className="mr-2" /> Add Your First Registrar
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {registrars.map(r => (
            <RegistrarCard key={r.id} r={r} onRefresh={refresh} />
          ))}
        </div>
      )}

      {/* Upload ZIP modal */}
      {showUpload && (
        <ZipUploadModal
          onClose={() => setShowUpload(false)}
          onRegistered={handleZipRegistered}
        />
      )}

      {/* Add / configure modal */}
      {showAdd && (
        <AddModal
          onClose={() => { setShowAdd(false); setZipPrefill(null); }}
          onSaved={refresh}
          prefill={zipPrefill}
        />
      )}
    </motion.div>
  );
}
