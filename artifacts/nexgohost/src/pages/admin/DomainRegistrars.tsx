import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Plus, Settings, Trash2, ToggleLeft, ToggleRight,
  CheckCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp,
  Eye, EyeOff, Star, X, Zap, Mail, Server, FolderOpen, File, BadgeCheck,
  Upload, Shield, ShieldAlert, PackageOpen, Sparkles, RotateCcw,
  FileArchive, CheckCircle2, ChevronRight, TrendingUp, DollarSign,
  Wallet, Activity, AlertTriangle,
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
    type: "spaceship", name: "Spaceship",
    description: "Modern, developer-friendly registrar with competitive pricing, wallet-based billing, and a live Loss-Prevention kill switch.",
    color: "from-sky-500/15 to-teal-400/5",
    badge: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    logo: "SS",
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

// ── AI Module Creator Modal ───────────────────────────────────────────────────
interface AiGenResult {
  message: string; moduleSlug: string; folderPath: string; folderName: string;
  phpFile: string; zipPath: string; configFields: ConfigField[];
  detectedEndpoints: Record<string, string>; apiFormat: string;
  description: string; hooksGenerated: boolean;
  dryRun: { passed: boolean; warnings: string[]; info: string[] };
  phpPreview: string;
}

type AiStep = { step: string; message: string };

function AiModuleCreatorModal({
  onClose, onRegistered,
}: { onClose: () => void; onRegistered: (result: AiGenResult) => void }) {
  const [inputType, setInputType]   = useState<"url" | "text">("url");
  const [input, setInput]           = useState("");
  const [regName, setRegName]       = useState("");
  const [generating, setGenerating] = useState(false);
  const [steps, setSteps]           = useState<AiStep[]>([]);
  const [result, setResult]         = useState<AiGenResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [showCode, setShowCode]     = useState(false);
  const { toast } = useToast();
  const stepsEndRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    if (!input.trim())   { toast({ title: "Provide API docs URL or text", variant: "destructive" }); return; }
    if (!regName.trim()) { toast({ title: "Enter a registrar name", variant: "destructive" }); return; }

    setGenerating(true);
    setSteps([]);
    setResult(null);
    setError(null);

    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/admin/domain-registrars/ai-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ input: input.trim(), inputType, registrarName: regName.trim() }),
      });

      if (!res.body) throw new Error("No SSE stream received");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "status") {
              setSteps(s => [...s, { step: evt.step, message: evt.message }]);
              setTimeout(() => stepsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            } else if (evt.type === "complete") {
              setResult(evt as AiGenResult);
            } else if (evt.type === "error") {
              setError(evt.message);
            }
          } catch { /* malformed chunk */ }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-card"
          style={{ background: `linear-gradient(135deg, ${BRAND}10 0%, transparent 70%)` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: BRAND }}>
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-[15px]">AI Module Creator</h2>
              <p className="text-xs text-muted-foreground">Paste an API doc URL or text → get a full registrar module</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {!result ? (
            <>
              {/* Input type tabs */}
              <div className="flex gap-1 p-1 bg-muted/40 rounded-xl border border-border">
                {(["url", "text"] as const).map(t => (
                  <button key={t} onClick={() => setInputType(t)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      inputType === t
                        ? "bg-card text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {t === "url" ? "🔗 API Documentation URL" : "📄 Paste Documentation Text"}
                  </button>
                ))}
              </div>

              {/* Registrar name */}
              <div>
                <Label className="text-xs font-semibold mb-1.5">Registrar Name <span className="text-red-500">*</span></Label>
                <Input
                  value={regName} onChange={e => setRegName(e.target.value)}
                  placeholder="e.g. Spaceship, Ionos, Dynadot, TPP Wholesale…"
                  className="rounded-xl" disabled={generating}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Used as the PHP module prefix (e.g. "spaceship" → <code className="font-mono">spaceship_RegisterDomain()</code>)
                </p>
              </div>

              {/* Documentation input */}
              <div>
                <Label className="text-xs font-semibold mb-1.5">
                  {inputType === "url" ? "API Documentation URL" : "API Documentation Text"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                {inputType === "url" ? (
                  <Input
                    value={input} onChange={e => setInput(e.target.value)}
                    placeholder="https://developer.spaceship.com/api-reference"
                    className="rounded-xl font-mono text-sm" disabled={generating}
                  />
                ) : (
                  <Textarea
                    value={input} onChange={e => setInput(e.target.value)}
                    placeholder={`Paste your registrar API documentation here…\n\nExample:\n  POST /v1/domains/register\n  Body: { "domain": "example.com", "apiKey": "...", "years": 1 }\n  …`}
                    rows={8} className="rounded-xl text-sm font-mono resize-none" disabled={generating}
                  />
                )}
              </div>

              {/* Capability badges */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "JSON API", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
                  { label: "XML/SOAP", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
                  { label: "REST", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
                  { label: "Auto-detect fields", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
                  { label: "Hooks auto-register", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
                  { label: "Dry-run validation", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
                ].map(b => (
                  <span key={b.label} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${b.color}`}>{b.label}</span>
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-300/50 bg-red-50 dark:bg-red-950/20 p-3">
                  <ShieldAlert size={14} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-400 whitespace-pre-line">{error}</p>
                </div>
              )}

              {/* Progress steps */}
              {steps.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Generation Progress</p>
                  {steps.map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {generating && i === steps.length - 1 ? (
                        <RefreshCw size={12} className="text-primary animate-spin shrink-0" />
                      ) : (
                        <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                      )}
                      <span className="text-xs text-foreground">{s.message}</span>
                    </div>
                  ))}
                  <div ref={stepsEndRef} />
                </div>
              )}

              {/* Generate button */}
              <Button
                onClick={handleGenerate}
                disabled={generating || !input.trim() || !regName.trim()}
                className="w-full rounded-xl text-white h-11 text-sm font-semibold gap-2"
                style={{ background: generating ? undefined : BRAND }}
              >
                {generating
                  ? <><RefreshCw size={14} className="animate-spin" /> Generating module…</>
                  : <><Sparkles size={14} /> Generate Registrar Module</>
                }
              </Button>
            </>
          ) : (
            /* ── Result ── */
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

              {/* Success */}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground text-sm">{regName}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">AI Generated</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 font-bold">{result.apiFormat}</span>
                  {result.hooksGenerated && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 border border-violet-500/20 font-bold">hooks.php</span>}
                </div>
                <p className="text-xs text-muted-foreground">{result.description}</p>

                {/* Detected endpoints */}
                {Object.keys(result.detectedEndpoints).length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Detected Endpoints</p>
                    <div className="space-y-1">
                      {Object.entries(result.detectedEndpoints).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-primary/70 w-24 shrink-0 capitalize">{k}</span>
                          <code className="font-mono text-muted-foreground text-[10px] truncate">{v}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Config fields */}
                {result.configFields.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Generated Config Fields</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {result.configFields.map(f => (
                        <div key={f.key} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: f.type === "password" ? "#ef4444" : f.type === "checkbox" ? "#10b981" : BRAND }} />
                          <span className="font-medium truncate">{f.label}</span>
                          {f.required && <span className="ml-auto text-red-500 text-[9px] shrink-0">req.</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Dry-run result */}
              <div className={`rounded-xl border p-4 ${result.dryRun.passed ? "border-emerald-300/40 bg-emerald-50/50 dark:bg-emerald-950/10" : "border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/10"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.dryRun.passed ? <Shield size={14} className="text-emerald-500" /> : <AlertCircle size={14} className="text-amber-500" />}
                  <span className="text-xs font-semibold text-foreground">
                    Dry-Run: {result.dryRun.passed ? "All checks passed" : `${result.dryRun.warnings.length} warning(s)`}
                  </span>
                </div>
                <div className="space-y-0.5 text-[11px] font-mono">
                  {result.dryRun.warnings.map((w, i) => <p key={i} className="text-amber-600 dark:text-amber-400">{w}</p>)}
                  {result.dryRun.info.slice(0, 5).map((info, i) => <p key={i} className="text-muted-foreground">{info}</p>)}
                </div>
              </div>

              {/* Code preview toggle */}
              <div className="rounded-xl border border-border overflow-hidden">
                <button onClick={() => setShowCode(c => !c)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/30 transition-colors">
                  <File size={13} className="text-primary" />
                  {regName.toLowerCase().replace(/\s+/g, "_")}.php preview
                  <span className="ml-auto text-muted-foreground">{showCode ? "▲ Hide" : "▼ Show"}</span>
                </button>
                <AnimatePresence>
                  {showCode && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                      <div className="border-t border-border bg-slate-950 dark:bg-slate-900 p-4 overflow-x-auto max-h-72 overflow-y-auto">
                        <pre className="text-[11px] text-slate-200 font-mono leading-relaxed whitespace-pre">
                          {result.phpPreview}
                          {result.phpPreview.length >= 2000 && "\n…[truncated — full file on server]"}
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setResult(null); setSteps([]); setError(null); }} className="rounded-xl flex-1">
                  ← Generate Another
                </Button>
                <Button onClick={() => onRegistered(result)} style={{ background: BRAND }}
                  className="text-white rounded-xl flex-1 gap-2">
                  <ChevronRight size={14} /> Configure & Register →
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
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

// ── Spaceship Domain Operations Panel ─────────────────────────────────────────
type SpaceshipAction = "getInfo" | "getEpp" | "lock" | "unlock" | "updateNs" | "renew" | "transfer" | "register" | "getNameservers";

interface SpaceshipResult {
  success: boolean;
  result?: any;
  data?: any;
  eppCode?: string;
  nameservers?: string[];
  locked?: boolean;
  error?: string;
}

function SpaceshipOpsPanel({ registrarId }: { registrarId: string }) {
  const [balance, setBalance]           = useState<{ balance: number; currency: string } | null>(null);
  const [balLoading, setBalLoading]     = useState(false);
  const [domainName, setDomainName]     = useState("");
  const [activeTab, setActiveTab]       = useState<SpaceshipAction>("getInfo");
  const [period, setPeriod]             = useState("1");
  const [authCode, setAuthCode]         = useState("");
  const [nsInput, setNsInput]           = useState("ns1.noehost.com,ns2.noehost.com");
  const [running, setRunning]           = useState(false);
  const [result, setResult]             = useState<SpaceshipResult | null>(null);
  const { toast } = useToast();

  const fetchBalance = async () => {
    setBalLoading(true);
    try {
      const data = await apiFetch(`/api/admin/domain-registrars/${registrarId}/balance`);
      setBalance({ balance: data.balance, currency: data.currency });
    } catch (err: any) {
      toast({ title: "Balance fetch failed", description: err.message, variant: "destructive" });
    } finally { setBalLoading(false); }
  };

  const runAction = async () => {
    if (!domainName.trim()) {
      toast({ title: "Enter a domain name", variant: "destructive" }); return;
    }
    setRunning(true);
    setResult(null);
    try {
      const body: Record<string, any> = {
        action: activeTab,
        domainName: domainName.trim() || undefined,
        period: Number(period),
      };
      if (activeTab === "transfer") body.authCode = authCode;
      if (activeTab === "updateNs" || activeTab === "register") body.nameservers = nsInput;
      const data = await apiFetch(`/api/admin/domain-registrars/${registrarId}/spaceship-action`, {
        method: "POST", body: JSON.stringify(body),
      });
      setResult(data);
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally { setRunning(false); }
  };

  const TABS: { id: SpaceshipAction; label: string; icon: string; needsDomain: boolean }[] = [
    { id: "getInfo",       label: "Domain Info",   icon: "🔍", needsDomain: true  },
    { id: "getEpp",        label: "EPP Code",      icon: "🔑", needsDomain: true  },
    { id: "lock",          label: "Lock",          icon: "🔒", needsDomain: true  },
    { id: "unlock",        label: "Unlock",        icon: "🔓", needsDomain: true  },
    { id: "getNameservers",label: "Get NS",        icon: "🌐", needsDomain: true  },
    { id: "updateNs",      label: "Update NS",     icon: "✏️", needsDomain: true  },
    { id: "renew",         label: "Renew",         icon: "🔄", needsDomain: true  },
    { id: "transfer",      label: "Transfer",      icon: "📤", needsDomain: true  },
    { id: "register",      label: "Register",      icon: "➕", needsDomain: true  },
  ];

  const curTab = TABS.find(t => t.id === activeTab)!;

  function renderResult() {
    if (!result) return null;
    const isOk = result.success !== false && !result.error;
    return (
      <div className={`mt-3 rounded-xl border p-3 text-xs ${isOk ? "border-emerald-400/30 bg-emerald-50/60 dark:bg-emerald-950/20" : "border-red-400/30 bg-red-50/60 dark:bg-red-950/20"}`}>
        <div className={`font-semibold mb-1 flex items-center gap-1.5 ${isOk ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
          {isOk ? "✅" : "❌"} {isOk ? "Success" : "Error"}
        </div>
        {result.error && <p className="text-red-600 dark:text-red-400">{result.error}</p>}
        {result.eppCode && (
          <div className="mt-1">
            <span className="text-muted-foreground">EPP / Auth Code: </span>
            <code className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded select-all">{result.eppCode}</code>
          </div>
        )}
        {result.locked !== undefined && (
          <p className="text-foreground">Lock Status: <strong>{result.locked ? "🔒 Locked" : "🔓 Unlocked"}</strong></p>
        )}
        {result.nameservers && (
          <div className="mt-1">
            <p className="text-muted-foreground font-medium">Nameservers:</p>
            <ul className="mt-0.5 space-y-0.5">{result.nameservers.map((ns, i) => (
              <li key={i} className="font-mono text-foreground">{ns}</li>
            ))}</ul>
          </div>
        )}
        {(result.data || result.result) && !result.eppCode && result.locked === undefined && !result.nameservers && (
          <pre className="mt-1 font-mono text-foreground bg-muted/50 rounded-lg p-2 overflow-x-auto max-h-40 overflow-y-auto text-[10px] whitespace-pre-wrap break-all">
            {JSON.stringify(result.data ?? result.result, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4 border border-violet-500/20 rounded-xl overflow-hidden">
      {/* Header with Balance */}
      <div className="flex items-center justify-between bg-violet-500/5 px-4 py-3 border-b border-violet-500/15">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-violet-500" />
          <span className="text-sm font-semibold text-foreground">Domain Operations</span>
        </div>
        <div className="flex items-center gap-2">
          {balance && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 border border-teal-500/20 font-semibold flex items-center gap-1">
              <Wallet size={9} /> ${balance.balance.toFixed(2)} {balance.currency}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={fetchBalance} disabled={balLoading}
            className="h-6 rounded-lg text-[10px] px-2 gap-1 border-violet-500/30 text-violet-600 hover:bg-violet-500/10">
            {balLoading ? <RefreshCw size={9} className="animate-spin" /> : <Wallet size={9} />}
            {balance ? "Refresh Balance" : "Check Balance"}
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Domain name input */}
        <div className="flex gap-2 items-center">
          <Globe size={14} className="text-muted-foreground shrink-0" />
          <Input
            value={domainName}
            onChange={e => setDomainName(e.target.value)}
            placeholder="example.com"
            className="h-8 text-xs rounded-lg font-mono flex-1"
          />
        </div>

        {/* Action tabs */}
        <div className="flex flex-wrap gap-1.5">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setResult(null); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                activeTab === tab.id
                  ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:border-violet-400/40 hover:text-foreground"
              }`}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Action-specific inputs */}
        {(activeTab === "renew" || activeTab === "register") && (
          <div className="flex items-center gap-2">
            <Label className="text-[11px] text-muted-foreground shrink-0">Years:</Label>
            <Input value={period} onChange={e => setPeriod(e.target.value)} type="number" min="1" max="10"
              className="h-7 text-xs rounded-lg w-20" />
          </div>
        )}
        {activeTab === "transfer" && (
          <div className="flex items-center gap-2">
            <Label className="text-[11px] text-muted-foreground shrink-0">Auth/EPP Code:</Label>
            <Input value={authCode} onChange={e => setAuthCode(e.target.value)} placeholder="auth-code-here"
              className="h-7 text-xs rounded-lg flex-1 font-mono" />
          </div>
        )}
        {(activeTab === "updateNs" || activeTab === "register") && (
          <div>
            <Label className="text-[11px] text-muted-foreground block mb-1">Nameservers (comma-separated):</Label>
            <Input value={nsInput} onChange={e => setNsInput(e.target.value)}
              placeholder="ns1.noehost.com,ns2.noehost.com"
              className="h-7 text-xs rounded-lg font-mono" />
          </div>
        )}

        {/* Run button */}
        <Button size="sm" onClick={runAction} disabled={running}
          className="w-full h-8 rounded-lg text-xs font-semibold gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          {running ? <RefreshCw size={11} className="animate-spin" /> : <span>{curTab.icon}</span>}
          {running ? "Running…" : `${curTab.label}${domainName ? ` — ${domainName}` : ""}`}
        </Button>

        {/* Result */}
        {renderResult()}
      </div>
    </div>
  );
}

// ── Registrar card ────────────────────────────────────────────────────────────
interface TldPrice {
  tld: string;
  registrationUsd: number | null;
  renewalUsd: number | null;
  transferUsd: number | null;
  registrationPkr: number | null;
  renewalPkr: number | null;
  transferPkr: number | null;
}

interface LivePriceData {
  usdToPkr: number;
  buffer: number;
  balance: { balance: number | null; currency: string };
  prices: TldPrice[];
}

function RegistrarCard({ r, onRefresh }: { r: Registrar; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>(r.config ?? {});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPrices, setShowPrices] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [liveData, setLiveData] = useState<LivePriceData | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [tldInput, setTldInput] = useState(".com,.net,.org,.store,.online,.pk");
  const { toast } = useToast();

  const preset = PRESETS.find(p => p.type === r.type);

  const fetchLivePrices = async () => {
    setLoadingPrices(true);
    setPriceError(null);
    try {
      const data = await apiFetch(
        `/api/admin/domain-registrars/${r.id}/live-tld-prices?tlds=${encodeURIComponent(tldInput)}`
      );
      setLiveData(data);
      setShowPrices(true);
    } catch (err: any) {
      setPriceError(err.message);
      toast({ title: "Error fetching live prices", description: err.message, variant: "destructive" });
    } finally { setLoadingPrices(false); }
  };

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

              {/* Spaceship Domain Operations Panel */}
              {r.type === "spaceship" && (
                <SpaceshipOpsPanel registrarId={r.id} />
              )}

              {/* Spaceship Live Prices Panel */}
              {r.type === "spaceship" && (
                <div className="mb-4 border border-sky-500/20 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between bg-sky-500/5 px-4 py-3 border-b border-sky-500/15">
                    <div className="flex items-center gap-2">
                      <Activity size={14} className="text-sky-500" />
                      <span className="text-sm font-semibold text-foreground">Live API Prices</span>
                      {liveData && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 border border-sky-500/20 font-medium">
                          Rate: Rs. {liveData.usdToPkr}/USD (+Rs.{liveData.buffer} buffer)
                        </span>
                      )}
                      {liveData?.balance?.balance != null && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 border border-teal-500/20 font-medium flex items-center gap-1">
                          <Wallet size={9} /> ${liveData.balance.balance} wallet
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={tldInput}
                        onChange={e => setTldInput(e.target.value)}
                        placeholder=".com,.net,.store"
                        className="h-7 text-xs rounded-lg w-40 border-sky-500/20"
                      />
                      <Button size="sm" onClick={fetchLivePrices} disabled={loadingPrices}
                        className="h-7 rounded-lg text-xs gap-1 bg-sky-600 hover:bg-sky-700 text-white">
                        {loadingPrices ? <RefreshCw size={10} className="animate-spin" /> : <TrendingUp size={10} />}
                        {loadingPrices ? "Fetching…" : "Fetch"}
                      </Button>
                    </div>
                  </div>

                  {priceError && (
                    <div className="flex items-center gap-2 p-3 text-xs text-red-500 bg-red-500/5">
                      <AlertTriangle size={12} /> {priceError}
                    </div>
                  )}

                  {showPrices && liveData && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[10px] text-muted-foreground border-b border-border">
                            <th className="text-left px-4 py-2 font-semibold">TLD</th>
                            <th className="text-right px-3 py-2 font-semibold">Reg (USD)</th>
                            <th className="text-right px-3 py-2 font-semibold">Reg (PKR)</th>
                            <th className="text-right px-3 py-2 font-semibold">Renew (USD)</th>
                            <th className="text-right px-3 py-2 font-semibold">Renew (PKR)</th>
                            <th className="text-right px-3 py-2 font-semibold">Transfer (USD)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {liveData.prices.map((p, i) => (
                            <tr key={p.tld} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-muted/10" : ""}`}>
                              <td className="px-4 py-2 font-mono font-bold text-sky-600">{p.tld}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground">
                                {p.registrationUsd != null ? `$${p.registrationUsd.toFixed(2)}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-foreground">
                                {p.registrationPkr != null ? `Rs. ${p.registrationPkr.toLocaleString()}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right text-muted-foreground">
                                {p.renewalUsd != null ? `$${p.renewalUsd.toFixed(2)}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-foreground">
                                {p.renewalPkr != null ? `Rs. ${p.renewalPkr.toLocaleString()}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right text-muted-foreground">
                                {p.transferUsd != null ? `$${p.transferUsd.toFixed(2)}` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!showPrices && !loadingPrices && !priceError && (
                    <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                      <DollarSign size={20} className="mx-auto mb-2 text-muted-foreground/40" />
                      Enter TLD(s) above and click Fetch to see live API costs and PKR equivalents
                    </div>
                  )}
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
  const [showAiCreator, setShowAiCreator] = useState(false);
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

  const handleAiRegistered = (result: AiGenResult) => {
    setShowAiCreator(false);
    // Convert AI result to the ZipUploadResult shape that AddModal accepts
    setZipPrefill({
      name: result.moduleSlug.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      description: result.description,
      phpModuleName: result.moduleSlug,
      folderName: result.folderName,
      folderPath: result.folderPath,
      configFields: result.configFields,
      hooks: [],
      detected: true,
      securityWarnings: [],
      message: result.message,
    });
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
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setShowAiCreator(true)}
            className="rounded-xl gap-2 border-violet-400/40 text-violet-600 dark:text-violet-400 hover:bg-violet-500/5"
          >
            <Sparkles size={14} /> AI Generate
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowUpload(true)}
            className="rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary/5"
          >
            <Upload size={14} /> Upload (.zip)
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

      {/* AI Module Creator modal */}
      {showAiCreator && (
        <AiModuleCreatorModal
          onClose={() => setShowAiCreator(false)}
          onRegistered={handleAiRegistered}
        />
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
