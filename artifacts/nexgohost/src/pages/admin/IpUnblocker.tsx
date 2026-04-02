import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Zap, CheckCircle2, XCircle, Loader2,
  ClipboardPaste, RotateCcw, Info, Server, Key,
  ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

const LS_ENDPOINT = "ip_unblocker_endpoint";
const LS_APIKEY   = "ip_unblocker_apikey";

const IPV4_RE = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)(\/\d{1,2})?$/;

interface Result {
  ip: string;
  success: boolean;
  message: string;
}

function validateIps(raw: string): { valid: string[]; invalid: string[] } {
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const l of lines) {
    (IPV4_RE.test(l) ? valid : invalid).push(l);
  }
  return { valid, invalid };
}

export default function IpUnblocker() {
  const { toast } = useToast();
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey]     = useState("");
  const [ipsRaw, setIpsRaw]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState<Result[]>([]);
  const [showConfig, setShowConfig] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ep  = localStorage.getItem(LS_ENDPOINT) ?? "";
    const key = localStorage.getItem(LS_APIKEY)   ?? "";
    if (ep)  setEndpoint(ep);
    if (key) setApiKey(key);
    if (!ep || !key) setShowConfig(true);
  }, []);

  const { valid: validIps, invalid: invalidIps } = validateIps(ipsRaw);

  const handleLoadFromServer = async () => {
    try {
      const data = await apiFetch("/api/admin/servers?type=cpanel");
      const servers = Array.isArray(data?.servers) ? data.servers : (Array.isArray(data) ? data : []);
      const first = servers[0];
      if (!first) { toast({ title: "No cPanel server found", description: "Add a server in Infrastructure → Servers first.", variant: "destructive" }); return; }
      const ep = `https://${first.hostname}:${first.apiPort ?? 2087}/whitelist`;
      setEndpoint(ep);
      if (first.apiToken) setApiKey(first.apiToken);
      toast({ title: "Auto-filled from server config", description: first.name });
    } catch {
      toast({ title: "Could not load servers", variant: "destructive" });
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setIpsRaw(prev => prev ? `${prev.trimEnd()}\n${text.trim()}` : text.trim());
      textareaRef.current?.focus();
    } catch {
      textareaRef.current?.focus();
    }
  };

  const handleClear = () => { setIpsRaw(""); setResults([]); };

  const handleSubmit = async () => {
    if (!endpoint.trim()) { toast({ title: "API Endpoint required", description: "Enter the server's whitelist API URL.", variant: "destructive" }); return; }
    if (!apiKey.trim())   { toast({ title: "API Key required", description: "Enter your server API key.", variant: "destructive" }); return; }
    if (validIps.length === 0) { toast({ title: "No valid IPs", description: "Enter at least one valid IPv4 address.", variant: "destructive" }); return; }

    localStorage.setItem(LS_ENDPOINT, endpoint.trim());
    localStorage.setItem(LS_APIKEY, apiKey.trim());

    setLoading(true);
    setResults([]);
    try {
      const data = await apiFetch("/api/admin/ip-unblocker/whitelist", {
        method: "POST",
        body: JSON.stringify({ endpoint: endpoint.trim(), apiKey: apiKey.trim(), ips: validIps }),
      });
      const res: Result[] = data.results ?? [];
      setResults(res);

      const succeeded = res.filter(r => r.success).length;
      const failed    = res.filter(r => !r.success).length;

      if (succeeded > 0 && failed === 0) {
        toast({
          title: `✅ ${succeeded} IP${succeeded > 1 ? "s" : ""} whitelisted!`,
          description: "The client's IP${succeeded > 1 ? 's have' : ' has'} been unblocked successfully.",
        });
      } else if (succeeded > 0) {
        toast({
          title: `⚠️ ${succeeded} succeeded, ${failed} failed`,
          description: "Check the results table below for details.",
          variant: "destructive",
        });
      } else {
        toast({ title: "All requests failed", description: "Check the endpoint URL and API key.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Request Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const ipLines = ipsRaw.split("\n").map(l => l.trim()).filter(Boolean);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <ShieldCheck size={24} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Client IP Unblocker</h1>
            <p className="text-sm text-muted-foreground">Instantly whitelist client IPs via direct API — no server config required</p>
          </div>
        </motion.div>

        {/* Config Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card border border-border rounded-2xl overflow-hidden"
        >
          <button
            onClick={() => setShowConfig(v => !v)}
            className="w-full flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Key size={16} className="text-violet-500" />
              <span className="font-semibold text-sm text-foreground">API Configuration</span>
              {endpoint && apiKey && (
                <span className="text-[10px] font-semibold bg-green-500/10 text-green-600 border border-green-500/20 px-2 py-0.5 rounded-full">Configured</span>
              )}
            </div>
            {showConfig ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {showConfig && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 space-y-4 border-t border-border/50 pt-4">
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-violet-500/5 border border-violet-500/15">
                    <Info size={14} className="text-violet-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Settings are saved locally in your browser for convenience.
                      The API key is sent securely to your configured endpoint — it is never logged or stored on our servers.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">API Endpoint URL</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Server size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={endpoint}
                          onChange={e => setEndpoint(e.target.value)}
                          placeholder="https://your-server.com/api/whitelist"
                          className="pl-9 font-mono text-sm"
                        />
                      </div>
                      <Button variant="outline" size="sm" onClick={handleLoadFromServer} className="shrink-0 gap-1.5 text-xs">
                        <RotateCcw size={13} />
                        Auto-fill
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Full URL of the whitelist endpoint. Click Auto-fill to load from your server config.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">API Key</label>
                    <div className="relative">
                      <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="Enter your server API key"
                        className="pl-9 font-mono text-sm"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Sent as <code className="bg-secondary px-1 rounded text-[10px]">Authorization: Bearer …</code> and <code className="bg-secondary px-1 rounded text-[10px]">X-Api-Key</code> headers.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* IP Input Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Client IP Addresses</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Paste one or more IPv4 addresses, one per line</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePaste} className="gap-1.5 text-xs">
                <ClipboardPaste size={13} />
                Paste
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1.5 text-xs text-muted-foreground">
                <RotateCcw size={13} />
                Clear
              </Button>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={ipsRaw}
            onChange={e => setIpsRaw(e.target.value)}
            placeholder={"192.168.1.1\n203.0.113.5\n198.51.100.22"}
            rows={6}
            className="w-full rounded-xl border border-border bg-secondary/20 px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 resize-y focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
          />

          {/* Validation Preview */}
          {ipLines.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {ipLines.map((ip, i) => {
                const isValid = IPV4_RE.test(ip);
                return (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-lg border ${
                      isValid
                        ? "bg-green-500/8 border-green-500/20 text-green-700 dark:text-green-400"
                        : "bg-red-500/8 border-red-500/20 text-red-600 dark:text-red-400"
                    }`}
                  >
                    {isValid ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                    {ip}
                  </span>
                );
              })}
            </div>
          )}

          {invalidIps.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle size={13} />
              <span>{invalidIps.length} invalid IP{invalidIps.length > 1 ? "s" : ""} will be skipped</span>
            </div>
          )}

          {/* Stats row */}
          {validIps.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border/50 pt-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {validIps.length} valid IP{validIps.length > 1 ? "s" : ""} ready
              </span>
              {invalidIps.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {invalidIps.length} will be skipped
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* Action Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Button
            onClick={handleSubmit}
            disabled={loading || validIps.length === 0 || !endpoint || !apiKey}
            className="w-full h-14 text-base font-semibold gap-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl shadow-lg shadow-violet-500/20 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Whitelisting {validIps.length} IP{validIps.length > 1 ? "s" : ""}…
              </>
            ) : (
              <>
                <Zap size={20} />
                Whitelist Now
                {validIps.length > 0 && (
                  <span className="ml-1 bg-white/20 px-2 py-0.5 rounded-lg text-sm">
                    {validIps.length} IP{validIps.length > 1 ? "s" : ""}
                  </span>
                )}
              </>
            )}
          </Button>
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-violet-500" />
                  <span className="font-semibold text-sm">Whitelist Results</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-green-600 font-semibold">{results.filter(r => r.success).length} ✓</span>
                  <span className="text-red-500 font-semibold">{results.filter(r => !r.success).length} ✗</span>
                </div>
              </div>

              <div className="divide-y divide-border/40">
                {results.map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`flex items-center gap-4 px-5 py-3.5 ${
                      r.success ? "bg-green-500/3" : "bg-red-500/3"
                    }`}
                  >
                    <div className="shrink-0">
                      {r.success
                        ? <CheckCircle2 size={18} className="text-green-600" />
                        : <XCircle size={18} className="text-red-500" />}
                    </div>
                    <div className="font-mono text-sm font-semibold text-foreground min-w-[140px]">{r.ip}</div>
                    <div className={`text-xs flex-1 ${r.success ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {r.message}
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      r.success
                        ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
                        : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                    }`}>
                      {r.success ? "UNBLOCKED" : "FAILED"}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
