import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import {
  CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw,
  Server, Users, Globe, FileText, Package, ArrowRight,
  ArrowLeft, Link, Key, Eye, EyeOff, ClipboardList,
  Shield, Zap, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Credentials { whmcsUrl: string; identifier: string; secret: string; }
interface Preview { clients: number; plans: number; services: number; domains: number; invoices: number; }
interface ImportResult { clients: number; plans: number; services: number; domains: number; invoices: number; servers: number; skipped: number; errors: number; }
interface JobStatus {
  jobId: string; status: "running" | "completed" | "failed";
  step: string; current: number; total: number;
  logs: string[]; result: ImportResult;
  startedAt: string; completedAt?: string;
}
interface ImportOptions {
  importPlans: boolean; importClients: boolean; importServices: boolean;
  importDomains: boolean; importInvoices: boolean; skipExistingClients: boolean;
}

// ── Step badge ────────────────────────────────────────────────────────────────
function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${active ? "opacity-100" : "opacity-40"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
        ${done ? "bg-green-500 border-green-500 text-white"
          : active ? "bg-purple-600 border-purple-600 text-white"
          : "bg-transparent border-gray-600 text-gray-400"}`}>
        {done ? <CheckCircle size={16} /> : n}
      </div>
      <span className={`text-sm font-medium hidden sm:block ${active ? "text-white" : "text-gray-500"}`}>{label}</span>
    </div>
  );
}

function ProgressBar({ value, max, color = "bg-purple-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all duration-300 rounded-full`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WhmcsImport() {
  const { toast } = useToast();
  const [step, setStep] = useState(1); // 1=creds, 2=preview, 3=options, 4=progress, 5=done
  const [creds, setCreds] = useState<Credentials>({ whmcsUrl: "", identifier: "", secret: "" });
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [options, setOptions] = useState<ImportOptions>({
    importPlans: true, importClients: true, importServices: true,
    importDomains: true, importInvoices: true, skipExistingClients: true,
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [jobStatus?.logs]);

  // Poll job status
  useEffect(() => {
    if (!jobId || !["running"].includes(jobStatus?.status ?? "")) return;
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch(`/api/admin/whmcs/import/${jobId}/status`);
        setJobStatus(data);
        if (data.status !== "running") {
          clearInterval(pollRef.current!);
          setStep(5);
        }
      } catch {}
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId, jobStatus?.status]);

  // ── Step 1: Test connection ────────────────────────────────────────────────
  async function handleTest() {
    if (!creds.whmcsUrl || !creds.identifier || !creds.secret) {
      toast({ title: "Missing Fields", description: "Fill in all credential fields.", variant: "destructive" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await apiFetch("/api/admin/whmcs/test", { method: "POST", body: JSON.stringify(creds) });
      setTestResult({ ok: true, message: r.message });
      toast({ title: "Connected!", description: r.message });
    } catch (e: any) {
      const msg = e.message ?? "Connection failed";
      setTestResult({ ok: false, message: msg });
    } finally {
      setTesting(false);
    }
  }

  // ── Step 2: Preview ────────────────────────────────────────────────────────
  async function handlePreview() {
    setPreviewing(true);
    try {
      const data = await apiFetch("/api/admin/whmcs/preview", { method: "POST", body: JSON.stringify(creds) });
      if (data.error) throw new Error(data.error);
      setPreview(data);
      setStep(2);
    } catch (e: any) {
      toast({ title: "Preview Failed", description: e.message, variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  }

  // ── Step 4: Start import ───────────────────────────────────────────────────
  async function handleImport() {
    try {
      const r = await apiFetch("/api/admin/whmcs/import", { method: "POST", body: JSON.stringify({ ...creds, options }) });
      if (r.error) throw new Error(r.error);
      setJobId(r.jobId);
      setJobStatus({ jobId: r.jobId, status: "running", step: "Starting…", current: 0, total: 0, logs: [], result: { clients: 0, plans: 0, services: 0, domains: 0, invoices: 0, servers: 0, skipped: 0, errors: 0 }, startedAt: new Date().toISOString() });
      setStep(4);
    } catch (e: any) {
      toast({ title: "Import Failed", description: e.message, variant: "destructive" });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-600/20 rounded-xl border border-purple-500/30">
            <RefreshCw size={28} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">WHMCS Import</h1>
            <p className="text-gray-400 text-sm">Migrate all your WHMCS data to Nexgohost automatically</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="bg-[#16162a] border border-[#2a2a4a] rounded-xl p-4 flex items-center justify-between gap-2">
          <StepBadge n={1} label="Connect" active={step >= 1} done={step > 1} />
          <div className="flex-1 h-px bg-gray-700" />
          <StepBadge n={2} label="Preview" active={step >= 2} done={step > 2} />
          <div className="flex-1 h-px bg-gray-700" />
          <StepBadge n={3} label="Configure" active={step >= 3} done={step > 3} />
          <div className="flex-1 h-px bg-gray-700" />
          <StepBadge n={4} label="Import" active={step >= 4} done={step > 4} />
          <div className="flex-1 h-px bg-gray-700" />
          <StepBadge n={5} label="Done" active={step >= 5} done={false} />
        </div>

        {/* ─── STEP 1: Credentials ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-[#16162a] border border-[#2a2a4a] rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Key size={18} className="text-purple-400" /> WHMCS API Credentials
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Go to WHMCS Admin → Setup → General Settings → Security → API Credentials to generate an API key.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1 font-medium">WHMCS URL</label>
                <div className="relative">
                  <Link size={16} className="absolute left-3 top-3 text-gray-500" />
                  <input
                    type="url" placeholder="https://billing.yourdomain.com"
                    value={creds.whmcsUrl}
                    onChange={e => setCreds(c => ({ ...c, whmcsUrl: e.target.value }))}
                    className="w-full bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1 font-medium">API Identifier</label>
                <div className="relative">
                  <Shield size={16} className="absolute left-3 top-3 text-gray-500" />
                  <input
                    type="text" placeholder="Your API Identifier"
                    value={creds.identifier}
                    onChange={e => setCreds(c => ({ ...c, identifier: e.target.value }))}
                    className="w-full bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1 font-medium">API Secret</label>
                <div className="relative">
                  <Key size={16} className="absolute left-3 top-3 text-gray-500" />
                  <input
                    type={showSecret ? "text" : "password"} placeholder="Your API Secret"
                    value={creds.secret}
                    onChange={e => setCreds(c => ({ ...c, secret: e.target.value }))}
                    className="w-full bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg pl-9 pr-10 py-2.5 text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                  />
                  <button type="button" onClick={() => setShowSecret(s => !s)} className="absolute right-3 top-3 text-gray-400 hover:text-white">
                    {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${testResult.ok ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
                {testResult.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
                {testResult.message}
              </div>
            )}

            {/* Disclaimer */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-300 flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <strong>Before you import:</strong> Make a database backup first. Clients will be assigned a temporary password <code className="bg-black/30 px-1 rounded">WhmcsMigrated@[id]</code> — ask them to reset it.
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleTest} disabled={testing}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg text-sm hover:border-purple-500 transition-colors disabled:opacity-50"
              >
                {testing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="text-yellow-400" />}
                Test Connection
              </button>
              <button
                onClick={handlePreview} disabled={previewing || !testResult?.ok}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {previewing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {previewing ? "Scanning WHMCS…" : "Preview Data"}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Preview counts ───────────────────────────────────────── */}
        {step === 2 && preview && (
          <div className="bg-[#16162a] border border-[#2a2a4a] rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <ClipboardList size={18} className="text-purple-400" /> Data Preview
              </h2>
              <p className="text-gray-400 text-sm mt-1">Here's what Nexgohost found in your WHMCS installation:</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { icon: Users,   label: "Clients",          value: preview.clients,  color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30" },
                { icon: Package, label: "Products / Plans",  value: preview.plans,    color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
                { icon: Server,  label: "Hosting Services", value: preview.services, color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30" },
                { icon: Globe,   label: "Domains",           value: preview.domains,  color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
                { icon: FileText,label: "Invoices",          value: preview.invoices, color: "text-pink-400",   bg: "bg-pink-500/10",   border: "border-pink-500/30" },
              ].map(({ icon: Icon, label, value, color, bg, border }) => (
                <div key={label} className={`${bg} border ${border} rounded-xl p-4 space-y-1`}>
                  <div className={`flex items-center gap-2 text-xs font-medium ${color}`}>
                    <Icon size={14} />{label}
                  </div>
                  <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
                </div>
              ))}
            </div>

            <div className="bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg p-3 text-sm text-gray-400">
              All data will be imported preserving original due dates, domains, billing cycles, and service status. Client passwords will be reset.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2.5 bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg text-sm hover:border-gray-500">
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={() => setStep(3)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold">
                Configure Import <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Options ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="bg-[#16162a] border border-[#2a2a4a] rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <RefreshCw size={18} className="text-purple-400" /> Import Configuration
              </h2>
              <p className="text-gray-400 text-sm mt-1">Choose which data to import and how to handle conflicts.</p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">What to Import</p>
              {([
                { key: "importPlans",    label: "Hosting Plans / Products", desc: "Import all WHMCS products as hosting plans",      icon: Package },
                { key: "importClients",  label: "Clients",                   desc: "Import all WHMCS client accounts as users",        icon: Users },
                { key: "importServices", label: "Hosting Services",          desc: "Import all active/suspended hosting services",     icon: Server },
                { key: "importDomains",  label: "Domains",                   desc: "Import all registered and transferred domains",    icon: Globe },
                { key: "importInvoices", label: "Invoices",                  desc: "Import all WHMCS invoices with paid/unpaid status",icon: FileText },
              ] as const).map(({ key, label, desc, icon: Icon }) => (
                <label key={key} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${options[key] ? "border-purple-500/50 bg-purple-500/5" : "border-[#2a2a4a] bg-[#0f0f1a]"}`}>
                  <input type="checkbox" checked={options[key]} onChange={e => setOptions(o => ({ ...o, [key]: e.target.checked }))} className="accent-purple-500 w-4 h-4" />
                  <Icon size={16} className={options[key] ? "text-purple-400" : "text-gray-500"} />
                  <div>
                    <div className="text-sm font-medium text-white">{label}</div>
                    <div className="text-xs text-gray-400">{desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Conflict Handling</p>
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${options.skipExistingClients ? "border-blue-500/50 bg-blue-500/5" : "border-[#2a2a4a] bg-[#0f0f1a]"}`}>
                <input type="checkbox" checked={options.skipExistingClients} onChange={e => setOptions(o => ({ ...o, skipExistingClients: e.target.checked }))} className="accent-blue-500 w-4 h-4" />
                <div>
                  <div className="text-sm font-medium text-white">Skip existing clients (recommended)</div>
                  <div className="text-xs text-gray-400">If a client email already exists, skip instead of overwriting.</div>
                </div>
              </label>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>This will import <strong>all data</strong> from your WHMCS installation into Nexgohost. This action cannot be automatically undone. Ensure you have a backup before proceeding.</div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2.5 bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg text-sm hover:border-gray-500">
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={handleImport} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-bold">
                <Zap size={16} /> Start Migration
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: Progress ────────────────────────────────────────────── */}
        {step === 4 && jobStatus && (
          <div className="bg-[#16162a] border border-[#2a2a4a] rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Loader2 size={22} className="text-purple-400 animate-spin" />
              <div>
                <h2 className="text-lg font-semibold text-white">Importing…</h2>
                <p className="text-gray-400 text-sm">{jobStatus.step}</p>
              </div>
            </div>

            {jobStatus.total > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{jobStatus.step}</span>
                  <span>{jobStatus.current} / {jobStatus.total}</span>
                </div>
                <ProgressBar value={jobStatus.current} max={jobStatus.total} />
              </div>
            )}

            {/* Live counters */}
            <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
              {Object.entries({
                Clients: jobStatus.result.clients, Plans: jobStatus.result.plans,
                Services: jobStatus.result.services, Domains: jobStatus.result.domains,
                Invoices: jobStatus.result.invoices, Servers: jobStatus.result.servers,
              }).map(([label, value]) => (
                <div key={label} className="bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg p-2 text-center">
                  <div className="text-xl font-bold text-purple-300">{value}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              ))}
            </div>

            {/* Logs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Live Log</p>
                <button onClick={() => setShowAllLogs(s => !s)} className="text-xs text-gray-500 hover:text-white flex items-center gap-1">
                  {showAllLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {showAllLogs ? "Show less" : "Show more"}
                </button>
              </div>
              <div ref={logsRef} className={`bg-black rounded-lg p-3 font-mono text-xs overflow-y-auto ${showAllLogs ? "max-h-96" : "max-h-48"} space-y-0.5`}>
                {jobStatus.logs.map((line, i) => (
                  <div key={i} className={line.startsWith("[ERR]") || line.startsWith("[FATAL]") ? "text-red-400" : line.startsWith("[INFO]") ? "text-gray-300" : "text-gray-400"}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 5: Done ────────────────────────────────────────────────── */}
        {step === 5 && jobStatus && (
          <div className="bg-[#16162a] border border-[#2a2a4a] rounded-xl p-6 space-y-6">
            <div className={`flex items-center gap-3 p-4 rounded-xl ${jobStatus.status === "completed" ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
              {jobStatus.status === "completed"
                ? <CheckCircle size={28} className="text-green-400 shrink-0" />
                : <XCircle size={28} className="text-red-400 shrink-0" />}
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {jobStatus.status === "completed" ? "Import Complete!" : "Import Failed"}
                </h2>
                <p className={`text-sm ${jobStatus.status === "completed" ? "text-green-400" : "text-red-400"}`}>
                  {jobStatus.status === "completed"
                    ? "All data has been successfully migrated to Nexgohost."
                    : "The import encountered a fatal error. Check the log below."}
                </p>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { icon: Users,    label: "Clients Imported",   value: jobStatus.result.clients,  color: "text-blue-400" },
                { icon: Package,  label: "Plans Imported",     value: jobStatus.result.plans,    color: "text-purple-400" },
                { icon: Server,   label: "Services Imported",  value: jobStatus.result.services, color: "text-green-400" },
                { icon: Globe,    label: "Domains Imported",   value: jobStatus.result.domains,  color: "text-yellow-400" },
                { icon: FileText, label: "Invoices Imported",  value: jobStatus.result.invoices, color: "text-pink-400" },
                { icon: AlertTriangle, label: "Errors",        value: jobStatus.result.errors,   color: "text-red-400" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-[#0f0f1a] border border-[#2a2a4a] rounded-xl p-4">
                  <div className={`flex items-center gap-2 text-xs font-medium ${color} mb-1`}>
                    <Icon size={12} />{label}
                  </div>
                  <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
                </div>
              ))}
            </div>

            <div className="text-xs text-gray-500 flex gap-4">
              <span>Skipped: {jobStatus.result.skipped}</span>
              {jobStatus.completedAt && (
                <span>Duration: {Math.round((new Date(jobStatus.completedAt).getTime() - new Date(jobStatus.startedAt).getTime()) / 1000)}s</span>
              )}
            </div>

            {/* Final log */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Import Log</p>
                <button onClick={() => setShowAllLogs(s => !s)} className="text-xs text-gray-500 hover:text-white flex items-center gap-1">
                  {showAllLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {showAllLogs ? "Collapse" : "Expand all"}
                </button>
              </div>
              <div ref={logsRef} className={`bg-black rounded-lg p-3 font-mono text-xs overflow-y-auto ${showAllLogs ? "max-h-[500px]" : "max-h-48"} space-y-0.5`}>
                {jobStatus.logs.map((line, i) => (
                  <div key={i} className={line.startsWith("[ERR]") || line.startsWith("[FATAL]") ? "text-red-400" : line.includes("✅") ? "text-green-400" : line.startsWith("[INFO]") ? "text-gray-300" : "text-gray-400"}>
                    {line}
                  </div>
                ))}
              </div>
            </div>

            {jobStatus.result.clients > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-300 flex gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>
                  Imported clients have temporary passwords: <code className="bg-black/30 px-1 rounded">WhmcsMigrated@[whmcs_id]</code>. 
                  Send them a password reset email from Admin → Clients.
                </div>
              </div>
            )}

            <button onClick={() => { setStep(1); setJobId(null); setJobStatus(null); setPreview(null); setTestResult(null); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg text-sm hover:border-purple-500">
              <RefreshCw size={16} /> Start New Import
            </button>
          </div>
        )}

        {/* Info Cards */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Users,    title: "Clients",         desc: "All client accounts, contact details, and credit balances" },
              { icon: Server,   title: "Hosting",         desc: "Active/suspended services with due dates, usernames, server info" },
              { icon: Globe,    title: "Domains",         desc: "All domains with nameservers, expiry dates, and auto-renew status" },
              { icon: FileText, title: "Invoices",        desc: "All invoices with payment status, due dates, and amounts" },
              { icon: Package,  title: "Products",        desc: "All WHMCS products become hosting plans with pricing" },
              { icon: Shield,   title: "Secure",          desc: "API credentials are never stored — used only during migration" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-[#16162a] border border-[#2a2a4a] rounded-xl p-4 flex gap-3">
                <div className="p-2 bg-purple-600/20 rounded-lg h-fit"><Icon size={16} className="text-purple-400" /></div>
                <div>
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
