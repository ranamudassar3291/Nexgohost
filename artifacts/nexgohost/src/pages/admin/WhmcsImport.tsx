import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import {
  CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw,
  Server, Users, Globe, FileText, Package, ArrowRight,
  ArrowLeft, Link, Key, Eye, EyeOff, ClipboardList,
  Shield, Zap, ChevronDown, ChevronUp, ShoppingCart, Tag, MessageSquare,
} from "lucide-react";

interface Credentials { whmcsUrl: string; identifier: string; secret: string; }
interface Preview {
  clients: number; plans: number; services: number; domains: number;
  invoices: number; orders: number; extensions: number; tickets: number;
}
interface ImportResult {
  extensions: number; plans: number; servers: number; clients: number;
  services: number; domains: number; orders: number; invoices: number;
  tickets: number; skipped: number; errors: number;
}
interface JobStatus {
  jobId: string; status: "running" | "completed" | "failed";
  step: string; stepIndex: number; totalSteps: number;
  current: number; total: number; logs: string[]; result: ImportResult;
  startedAt: string; completedAt?: string;
}
interface ImportOptions {
  importExtensions: boolean; importPlans: boolean; importServers: boolean;
  importClients: boolean; importPasswords: boolean; importServices: boolean;
  importDomains: boolean; importOrders: boolean; importInvoices: boolean;
  importTickets: boolean; skipExistingClients: boolean;
}

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

function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs text-gray-400">
          <span>{label}</span>
          <span>{max > 0 ? `${value} / ${max} (${pct}%)` : "…"}</span>
        </div>
      )}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-purple-500 transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StepProgress({ current, total }: { current: number; total: number }) {
  const steps = [
    "TLD Extensions", "Hosting Plans", "Servers", "Clients",
    "Hosting Services", "Domains", "Orders", "Invoices",
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {steps.map((s, i) => {
        const done = i + 1 < current;
        const active = i + 1 === current;
        return (
          <div key={s} className={`text-center p-2 rounded-lg text-xs font-medium transition-all
            ${done ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : active ? "bg-purple-500/20 text-purple-300 border border-purple-500/50"
              : "bg-[#0f0f1a] text-gray-600 border border-[#2a2a4a]"}`}>
            {done ? "✓ " : active ? "⟳ " : "○ "}{s}
          </div>
        );
      })}
    </div>
  );
}

export default function WhmcsImport() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [creds, setCreds] = useState<Credentials>({ whmcsUrl: "", identifier: "", secret: "" });
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [options, setOptions] = useState<ImportOptions>({
    importExtensions: true, importPlans: true, importServers: true,
    importClients: true, importPasswords: true, importServices: true,
    importDomains: true, importOrders: true, importInvoices: true,
    importTickets: true, skipExistingClients: true,
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [jobStatus?.logs]);

  useEffect(() => {
    if (!jobId || jobStatus?.status !== "running") return;
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

  async function handleTest() {
    if (!creds.whmcsUrl || !creds.identifier || !creds.secret) {
      toast({ title: "Missing Fields", description: "Fill all credential fields.", variant: "destructive" });
      return;
    }
    setTesting(true); setTestResult(null);
    try {
      const r = await apiFetch("/api/admin/whmcs/test", { method: "POST", body: JSON.stringify(creds) });
      setTestResult({ ok: true, message: r.message });
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message ?? "Connection failed" });
    } finally { setTesting(false); }
  }

  async function handlePreview() {
    setPreviewing(true);
    try {
      const data = await apiFetch("/api/admin/whmcs/preview", { method: "POST", body: JSON.stringify(creds) });
      setPreview(data);
      setStep(2);
    } catch (e: any) {
      toast({ title: "Preview Failed", description: e.message, variant: "destructive" });
    } finally { setPreviewing(false); }
  }

  async function handleImport() {
    try {
      const r = await apiFetch("/api/admin/whmcs/import", {
        method: "POST",
        body: JSON.stringify({ ...creds, options }),
      });
      setJobId(r.jobId);
      setJobStatus({
        jobId: r.jobId, status: "running", step: "Starting…", stepIndex: 0,
        totalSteps: 9, current: 0, total: 0, logs: [],
        result: { extensions: 0, plans: 0, servers: 0, clients: 0, services: 0, domains: 0, orders: 0, invoices: 0, tickets: 0, skipped: 0, errors: 0 },
        startedAt: new Date().toISOString(),
      });
      setStep(4);
    } catch (e: any) {
      toast({ title: "Import Failed", description: e.message, variant: "destructive" });
    }
  }

  const previewItems = preview ? [
    { icon: Tag,          label: "TLD Extensions",   value: preview.extensions, color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30" },
    { icon: Package,      label: "Hosting Plans",    value: preview.plans,      color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30" },
    { icon: Users,        label: "Clients",          value: preview.clients,    color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30" },
    { icon: Server,       label: "Hosting Services", value: preview.services,   color: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/30" },
    { icon: Globe,        label: "Domains",          value: preview.domains,    color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/30" },
    { icon: ShoppingCart,   label: "Orders",           value: preview.orders,   color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30" },
    { icon: FileText,       label: "Invoices",         value: preview.invoices, color: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/30" },
    { icon: MessageSquare,  label: "Tickets",          value: preview.tickets ?? 0,  color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-teal-500/30" },
  ] : [];

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-600/20 rounded-xl border border-purple-500/30">
            <RefreshCw size={28} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">WHMCS Full Migration</h1>
            <p className="text-gray-400 text-sm">Import all WHMCS data — plans, clients, services, domains, orders, invoices, tickets — in one shot with original numbers & dates</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="bg-[#16162a] border border-[#2a2a4a] rounded-xl p-4 flex items-center justify-between gap-2">
          {[{ n:1, l:"Connect" }, { n:2, l:"Preview" }, { n:3, l:"Configure" }, { n:4, l:"Migrate" }, { n:5, l:"Done" }].map(({ n, l }, i, arr) => (
            <>
              <StepBadge key={n} n={n} label={l} active={step >= n} done={step > n} />
              {i < arr.length - 1 && <div key={`div-${n}`} className="flex-1 h-px bg-gray-700" />}
            </>
          ))}
        </div>

        {/* ─── STEP 1: Credentials ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-[#16162a] border border-[#2a2a4a] rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Key size={18} className="text-purple-400" /> WHMCS API Credentials
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                WHMCS Admin → Setup → General Settings → Security → API Credentials
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1 font-medium">WHMCS URL</label>
                <div className="relative">
                  <Link size={16} className="absolute left-3 top-3 text-gray-500" />
                  <input type="url" placeholder="https://billing.yourdomain.com" value={creds.whmcsUrl}
                    onChange={e => setCreds(c => ({ ...c, whmcsUrl: e.target.value }))}
                    className="w-full bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1 font-medium">API Identifier</label>
                <div className="relative">
                  <Shield size={16} className="absolute left-3 top-3 text-gray-500" />
                  <input type="text" placeholder="Your API Identifier" value={creds.identifier}
                    onChange={e => setCreds(c => ({ ...c, identifier: e.target.value }))}
                    className="w-full bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1 font-medium">API Secret</label>
                <div className="relative">
                  <Key size={16} className="absolute left-3 top-3 text-gray-500" />
                  <input type={showSecret ? "text" : "password"} placeholder="Your API Secret" value={creds.secret}
                    onChange={e => setCreds(c => ({ ...c, secret: e.target.value }))}
                    className="w-full bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg pl-9 pr-10 py-2.5 text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none" />
                  <button type="button" onClick={() => setShowSecret(s => !s)} className="absolute right-3 top-3 text-gray-400 hover:text-white">
                    {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${testResult.ok ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
                {testResult.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
                {testResult.message}
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-300 flex gap-2">
              <Shield size={16} className="shrink-0 mt-0.5" />
              <div>
                <strong>Password Migration:</strong> If your WHMCS uses bcrypt (v7.6+) passwords, clients can login with their <strong>exact original password</strong> after migration. For older WHMCS (MD5), the system will auto-detect and compare correctly.
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleTest} disabled={testing}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg text-sm hover:border-purple-500 transition-colors disabled:opacity-50">
                {testing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="text-yellow-400" />}
                Test Connection
              </button>
              <button onClick={handlePreview} disabled={previewing || !testResult?.ok}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
                {previewing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {previewing ? "Scanning WHMCS…" : "Scan & Preview Data"}
              </button>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {[
                { icon: Tag,          title: "TLD Extensions",   desc: "All domain extensions with registration & renewal pricing" },
                { icon: Package,      title: "Hosting Plans",    desc: "Exact plan names, all billing cycle prices (monthly/yearly)" },
                { icon: Users,        title: "Clients",          desc: "Accounts with credit balances & original passwords" },
                { icon: Server,       title: "Hosting Services", desc: "Active/suspended services with due dates & server assignment" },
                { icon: Globe,        title: "Domains",          desc: "All domains with nameservers, expiry & due dates preserved" },
                { icon: ShoppingCart,  title: "Orders & Invoices", desc: "Complete order history, invoices with ORIGINAL invoice numbers" },
                { icon: MessageSquare, title: "Support Tickets",   desc: "All tickets with messages, dates, status & original ticket IDs" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-[#0f0f1a] border border-[#2a2a4a] rounded-xl p-3 flex gap-2">
                  <div className="p-1.5 bg-purple-600/20 rounded-lg h-fit"><Icon size={14} className="text-purple-400" /></div>
                  <div>
                    <div className="text-xs font-semibold text-white">{title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── STEP 2: Preview ─────────────────────────────────────────────── */}
        {step === 2 && preview && (
          <div className="bg-[#16162a] border border-[#2a2a4a] rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <ClipboardList size={18} className="text-purple-400" /> Data Preview
              </h2>
              <p className="text-gray-400 text-sm mt-1">Everything found in your WHMCS installation:</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {previewItems.map(({ icon: Icon, label, value, color, bg, border }) => (
                <div key={label} className={`${bg} border ${border} rounded-xl p-4 space-y-1`}>
                  <div className={`flex items-center gap-2 text-xs font-medium ${color}`}>
                    <Icon size={14} />{label}
                  </div>
                  <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2.5 bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg text-sm">
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
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <RefreshCw size={18} className="text-purple-400" /> Configure Import
            </h2>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">What to Import</p>
              {([
                { key: "importExtensions", label: "TLD Extensions & Pricing",   desc: "Import all domain extensions with registration/renewal/transfer prices", icon: Tag },
                { key: "importPlans",      label: "Hosting Plans",              desc: "Import all products with exact names and all billing cycle prices",      icon: Package },
                { key: "importServers",    label: "Servers",                    desc: "Import all cPanel/WHM servers and assign to services",                    icon: Server },
                { key: "importClients",    label: "Clients",                    desc: "Import all client accounts, credit balances and status",                  icon: Users },
                { key: "importPasswords",  label: "Client Passwords",           desc: "Fetch and import client password hashes — clients can login as before",   icon: Key },
                { key: "importServices",   label: "Hosting Services",           desc: "Import all active/suspended/terminated services with due dates",          icon: Server },
                { key: "importDomains",    label: "Domains",                    desc: "Import all domains with nameservers and expiry dates",                    icon: Globe },
                { key: "importOrders",     label: "Orders",                     desc: "Import all orders and link to clients/services",                          icon: ShoppingCart },
                { key: "importInvoices",   label: "Invoices",                   desc: "Import invoices with ORIGINAL WHMCS invoice numbers, paid/unpaid status", icon: FileText },
                { key: "importTickets",    label: "Support Tickets",            desc: "Import all tickets with messages, replies, dates, status & ticket IDs",    icon: MessageSquare },
              ] as const).map(({ key, label, desc, icon: Icon }) => (
                <label key={key} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${options[key] ? "border-purple-500/50 bg-purple-500/5" : "border-[#2a2a4a] bg-[#0f0f1a]"}`}>
                  <input type="checkbox" checked={options[key]} onChange={e => setOptions(o => ({ ...o, [key]: e.target.checked }))} className="accent-purple-500 w-4 h-4" />
                  <Icon size={15} className={options[key] ? "text-purple-400" : "text-gray-500"} />
                  <div>
                    <div className="text-sm font-medium text-white">{label}</div>
                    <div className="text-xs text-gray-400">{desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Conflict Handling</p>
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${options.skipExistingClients ? "border-blue-500/50 bg-blue-500/5" : "border-[#2a2a4a] bg-[#0f0f1a]"}`}>
                <input type="checkbox" checked={options.skipExistingClients} onChange={e => setOptions(o => ({ ...o, skipExistingClients: e.target.checked }))} className="accent-blue-500 w-4 h-4" />
                <div>
                  <div className="text-sm font-medium text-white">Skip clients that already exist (recommended)</div>
                  <div className="text-xs text-gray-400">Existing accounts won't be overwritten — their ID mapping is still used for services/invoices.</div>
                </div>
              </label>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>This is a one-time full migration. Ensure you have a database backup before proceeding. All data will be imported <strong>without duplicates</strong>.</div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2.5 bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg text-sm">
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={handleImport} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-bold">
                <Zap size={16} /> Start Full Migration
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: Live Progress ────────────────────────────────────────── */}
        {step === 4 && jobStatus && (
          <div className="bg-[#16162a] border border-[#2a2a4a] rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Loader2 size={22} className="text-purple-400 animate-spin" />
              <div>
                <h2 className="text-lg font-semibold text-white">Migrating…</h2>
                <p className="text-gray-400 text-sm">{jobStatus.step}</p>
              </div>
              <div className="ml-auto text-xs text-gray-500">
                Step {jobStatus.stepIndex}/{jobStatus.totalSteps}
              </div>
            </div>

            {/* Step grid */}
            <StepProgress current={jobStatus.stepIndex} total={jobStatus.totalSteps} />

            {/* Current step progress */}
            {jobStatus.total > 0 && (
              <ProgressBar value={jobStatus.current} max={jobStatus.total} label={jobStatus.step} />
            )}

            {/* Live counters */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { l: "TLDs",     v: jobStatus.result.extensions },
                { l: "Plans",    v: jobStatus.result.plans },
                { l: "Clients",  v: jobStatus.result.clients },
                { l: "Services", v: jobStatus.result.services },
                { l: "Domains",  v: jobStatus.result.domains },
                { l: "Orders",   v: jobStatus.result.orders },
                { l: "Invoices", v: jobStatus.result.invoices },
                { l: "Tickets",  v: jobStatus.result.tickets },
                { l: "Errors",   v: jobStatus.result.errors },
              ].map(({ l, v }) => (
                <div key={l} className="bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg p-2 text-center">
                  <div className={`text-lg font-bold ${l === "Errors" && v > 0 ? "text-red-400" : "text-purple-300"}`}>{v}</div>
                  <div className="text-xs text-gray-500">{l}</div>
                </div>
              ))}
            </div>

            {/* Live log */}
            <div>
              <div className="flex justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Live Log</p>
                <button onClick={() => setShowAllLogs(s => !s)} className="text-xs text-gray-500 hover:text-white flex items-center gap-1">
                  {showAllLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {showAllLogs ? "Less" : "More"}
                </button>
              </div>
              <div ref={logsRef} className={`bg-black rounded-lg p-3 font-mono text-xs overflow-y-auto ${showAllLogs ? "max-h-96" : "max-h-40"} space-y-0.5`}>
                {jobStatus.logs.map((line, i) => (
                  <div key={i} className={line.startsWith("[ERR]") || line.startsWith("[FATAL]") ? "text-red-400" : line.includes("──") ? "text-purple-300 font-semibold" : "text-gray-400"}>
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
                  {jobStatus.status === "completed" ? "Migration Complete!" : "Migration Failed"}
                </h2>
                <p className={`text-sm ${jobStatus.status === "completed" ? "text-green-400" : "text-red-400"}`}>
                  {jobStatus.status === "completed"
                    ? "All WHMCS data has been migrated successfully to Nexgohost."
                    : "A fatal error stopped the migration. Check the log below."}
                </p>
              </div>
              {jobStatus.completedAt && (
                <div className="ml-auto text-right text-xs text-gray-500">
                  <div>Duration</div>
                  <div className="text-white font-semibold">
                    {Math.round((new Date(jobStatus.completedAt).getTime() - new Date(jobStatus.startedAt).getTime()) / 1000)}s
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Tag,          label: "TLD Extensions",   value: jobStatus.result.extensions, color: "text-cyan-400" },
                { icon: Package,      label: "Plans",            value: jobStatus.result.plans,      color: "text-purple-400" },
                { icon: Server,       label: "Servers",          value: jobStatus.result.servers,    color: "text-indigo-400" },
                { icon: Users,        label: "Clients",          value: jobStatus.result.clients,    color: "text-blue-400" },
                { icon: Server,       label: "Services",         value: jobStatus.result.services,   color: "text-green-400" },
                { icon: Globe,        label: "Domains",          value: jobStatus.result.domains,    color: "text-yellow-400" },
                { icon: ShoppingCart, label: "Orders",           value: jobStatus.result.orders,     color: "text-orange-400" },
                { icon: FileText,      label: "Invoices",  value: jobStatus.result.invoices, color: "text-pink-400" },
                { icon: MessageSquare, label: "Tickets",   value: jobStatus.result.tickets,  color: "text-teal-400" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-[#0f0f1a] border border-[#2a2a4a] rounded-xl p-3">
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${color} mb-1`}>
                    <Icon size={12} />{label}
                  </div>
                  <div className="text-xl font-bold text-white">{value.toLocaleString()}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 text-xs text-gray-500">
              <span>Skipped (existing): {jobStatus.result.skipped}</span>
              <span>Errors: {jobStatus.result.errors}</span>
            </div>

            {jobStatus.result.clients > 0 && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-300 flex gap-2">
                <Shield size={16} className="shrink-0 mt-0.5" />
                <div>
                  <strong>Client Passwords:</strong> If password import was enabled, clients with WHMCS bcrypt ($2y$) passwords can log in immediately with their original password. Legacy MD5 clients can also log in — the system auto-detects and compares correctly.
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Migration Log</p>
                <button onClick={() => setShowAllLogs(s => !s)} className="text-xs text-gray-500 hover:text-white flex items-center gap-1">
                  {showAllLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {showAllLogs ? "Collapse" : "Expand all"}
                </button>
              </div>
              <div ref={logsRef} className={`bg-black rounded-lg p-3 font-mono text-xs overflow-y-auto ${showAllLogs ? "max-h-[600px]" : "max-h-48"}`}>
                {jobStatus.logs.map((line, i) => (
                  <div key={i} className={
                    line.startsWith("[ERR]") || line.startsWith("[FATAL]") ? "text-red-400" :
                    line.includes("✅") ? "text-green-400" :
                    line.includes("──") ? "text-purple-300 font-semibold" :
                    "text-gray-400"
                  }>{line}</div>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setStep(1); setJobId(null); setJobStatus(null); setPreview(null); setTestResult(null); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg text-sm hover:border-purple-500">
              <RefreshCw size={16} /> Start New Migration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
