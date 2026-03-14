import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  KeyRound, CheckCircle, AlertCircle, Loader2, ExternalLink,
  Shield, Globe, Eye, EyeOff, Copy, Check, TestTube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

async function apiFetch(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

export default function GoogleOAuth() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [cfg, setCfg] = useState({
    google_client_id: "",
    google_client_secret: "",
    google_allowed_domains: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [redirectUri, setRedirectUri] = useState("");

  useEffect(() => {
    const proto = window.location.protocol;
    const host = window.location.host;
    setRedirectUri(`${proto}//${host}/api/auth/google/callback`);

    apiFetch("/api/admin/settings")
      .then(d => {
        setCfg({
          google_client_id: d.google_client_id || "",
          google_client_secret: d.google_client_secret || "",
          google_allowed_domains: d.google_allowed_domains || "",
        });
        setConfigured(d.google_configured ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof typeof cfg) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCfg(prev => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      await apiFetch("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          google_client_id: cfg.google_client_id,
          google_client_secret: cfg.google_client_secret !== "••••••••" ? cfg.google_client_secret : undefined,
          google_allowed_domains: cfg.google_allowed_domains,
        }),
      });
      qc.invalidateQueries({ queryKey: ["admin-settings-email"] });
      toast({ title: "Google OAuth settings saved" });
      const d = await apiFetch("/api/admin/settings");
      setConfigured(d.google_configured ?? false);
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await apiFetch("/api/auth/google/config");
      if (data.configured) {
        setTestResult({ ok: true, msg: "Configuration looks good. Client ID and Client Secret are both saved." });
      } else if (data.hasClientId && !data.hasClientSecret) {
        setTestResult({ ok: false, msg: "Client Secret is missing. Please enter your Google OAuth Client Secret." });
      } else if (!data.hasClientId) {
        setTestResult({ ok: false, msg: "Client ID is missing. Please enter your Google OAuth Client ID." });
      } else {
        setTestResult({ ok: false, msg: "Configuration is incomplete. Please fill in both Client ID and Client Secret." });
      }
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message || "Failed to verify configuration." });
    } finally { setTesting(false); }
  };

  const copyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri).then(() => {
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Google OAuth</h1>
          <p className="text-muted-foreground text-sm">Allow clients to sign in with their Google account</p>
        </div>
        {configured && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full font-medium">
            <CheckCircle size={12} /> Active
          </span>
        )}
      </div>

      {/* Step 1: Google Console Setup */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
          <h2 className="font-semibold text-foreground">Create OAuth 2.0 Credentials in Google Cloud</h2>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-300/80 space-y-2">
          <p>1. Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-300 underline underline-offset-2">Google Cloud Console → APIs &amp; Services → Credentials</a></p>
          <p>2. Click <span className="text-foreground/80 font-medium">+ Create Credentials</span> → <span className="text-foreground/80 font-medium">OAuth 2.0 Client ID</span></p>
          <p>3. Application type: <span className="text-foreground/80 font-medium">Web application</span></p>
          <p>4. Under <span className="text-foreground/80 font-medium">Authorized redirect URIs</span>, add the URI below</p>
          <p>5. Copy your <span className="text-foreground/80 font-medium">Client ID</span> and <span className="text-foreground/80 font-medium">Client Secret</span> into the fields below</p>
        </div>
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="rounded-xl">
            <ExternalLink size={13} className="mr-2" /> Open Google Cloud Console
          </Button>
        </a>
      </div>

      {/* Step 2: Redirect URI */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
          <h2 className="font-semibold text-foreground">Authorized Redirect URI</h2>
        </div>
        <p className="text-sm text-muted-foreground">Copy this URI and paste it into your Google OAuth 2.0 client settings as an Authorized redirect URI.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-background/50 border border-white/10 rounded-xl px-4 py-2.5 font-mono text-xs text-foreground/70 truncate">
            {redirectUri}
          </div>
          <Button variant="outline" size="sm" onClick={copyRedirectUri} className="rounded-xl shrink-0">
            {copiedUri ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copiedUri ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>

      {/* Step 3: Enter Credentials */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</span>
          <h2 className="font-semibold text-foreground">Enter Your Credentials</h2>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80">Google Client ID</label>
          <Input
            value={cfg.google_client_id}
            onChange={set("google_client_id")}
            placeholder="123456789-abc.apps.googleusercontent.com"
            className="bg-background/50 border-white/10 font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
            Google Client Secret
            <Shield size={12} className="text-primary" />
            <span className="text-xs text-muted-foreground font-normal">Stored encrypted</span>
          </label>
          <div className="relative">
            <Input
              type={showSecret ? "text" : "password"}
              value={cfg.google_client_secret}
              onChange={set("google_client_secret")}
              placeholder="GOCSPX-••••••••••••••••••••••••••"
              className="bg-background/50 border-white/10 font-mono text-xs pr-10"
            />
            <button
              type="button"
              onClick={() => setShowSecret(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
            Allowed Email Domains
            <Globe size={12} className="text-muted-foreground" />
          </label>
          <Input
            value={cfg.google_allowed_domains}
            onChange={set("google_allowed_domains")}
            placeholder="example.com, company.org (leave blank to allow all)"
            className="bg-background/50 border-white/10 text-sm"
          />
          <p className="text-xs text-muted-foreground">Comma-separated. Only users with these email domains can sign in via Google. Leave blank to allow any Google account.</p>
        </div>

        {testResult && (
          <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${testResult.ok ? "border-green-500/20 bg-green-500/5 text-green-300" : "border-red-500/20 bg-red-500/5 text-red-300"}`}>
            {testResult.ok ? <CheckCircle size={15} className="shrink-0 mt-0.5" /> : <AlertCircle size={15} className="shrink-0 mt-0.5" />}
            {testResult.msg}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? <Loader2 size={15} className="animate-spin mr-2" /> : null}
            Save Configuration
          </Button>
          <Button onClick={handleTest} disabled={testing} variant="outline" className="rounded-xl">
            {testing ? <Loader2 size={15} className="animate-spin mr-2" /> : <TestTube size={15} className="mr-2" />}
            Test Connection
          </Button>
        </div>
      </div>

      {/* What happens when a user signs in */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <h2 className="font-semibold text-foreground text-sm">How it works</h2>
        <div className="space-y-2.5">
          {[
            { step: "Sign in", desc: "Client clicks 'Sign in with Google' on the login or register page" },
            { step: "Redirect", desc: "They are sent to Google's sign-in page to authorize your application" },
            { step: "Callback", desc: "Google redirects back to your panel with an authorization code" },
            { step: "Account", desc: "The system exchanges the code for user info — creating or logging into an account automatically" },
            { step: "Dashboard", desc: "The client is signed in and redirected to their dashboard" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <div>
                <span className="text-sm font-medium text-foreground">{item.step}: </span>
                <span className="text-sm text-muted-foreground">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
