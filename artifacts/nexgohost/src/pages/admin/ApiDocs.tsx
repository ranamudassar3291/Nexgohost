import { useState, useRef } from "react";
import {
  BookOpen, Key, Lock, Globe, Webhook, Users, FileText,
  ShoppingCart, RefreshCw, Copy, CheckCircle2, ChevronDown, ChevronRight,
  Shield, CreditCard, Bell, Settings, Play, Loader2, AlertCircle,
} from "lucide-react";

const BRAND = "#701AFE";
const BASE = "https://api.noehost.com";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  auth: "none" | "bearer" | "api-key";
  description: string;
  params?: { name: string; in: "header" | "query" | "body"; type: string; required: boolean; description: string }[];
  bodyExample?: object;
  responseExample?: object;
}

interface Section {
  id: string;
  icon: any;
  title: string;
  description: string;
  endpoints: Endpoint[];
}

// ─── Helper: copy ─────────────────────────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }
  return { copied, copy };
}

// ─── Method badge ─────────────────────────────────────────────────────────────
const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-emerald-100 text-emerald-700",
  POST:   "bg-blue-100 text-blue-700",
  PUT:    "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
  PATCH:  "bg-violet-100 text-violet-700",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded font-mono ${METHOD_COLORS[method] ?? "bg-gray-100 text-gray-600"}`}>
      {method}
    </span>
  );
}

function AuthBadge({ auth }: { auth: string }) {
  if (auth === "none") return <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">Public</span>;
  if (auth === "api-key") return <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">API Key</span>;
  return <span className="text-[10px] px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">Bearer JWT</span>;
}

function JsonBlock({ obj, id }: { obj: object; id: string }) {
  const { copied, copy } = useCopy();
  const text = JSON.stringify(obj, null, 2);
  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-emerald-400 text-xs rounded-lg px-4 py-3 overflow-x-auto leading-relaxed font-mono whitespace-pre">
        {text}
      </pre>
      <button
        onClick={() => copy(text, id)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded text-[10px] flex items-center gap-1"
      >
        {copied === id ? <><CheckCircle2 size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
      </button>
    </div>
  );
}

// ─── Try It Out panel ─────────────────────────────────────────────────────────
interface TryResult {
  status: number;
  ok: boolean;
  body: unknown;
  ms: number;
}

function TryItOut({ ep }: { ep: Endpoint }) {
  const [open,    setOpen]    = useState(false);
  const [token,   setToken]   = useState(() => localStorage.getItem("auth_token") ?? "");
  const [apiKey,  setApiKey]  = useState("");
  const [body,    setBody]    = useState(ep.bodyExample ? JSON.stringify(ep.bodyExample, null, 2) : "");
  const [pathVars, setPathVars] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result,  setResult]  = useState<TryResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Collect path params from ep.path e.g. :id :planId
  const pathParamNames = (ep.path.match(/:[a-zA-Z]+/g) ?? []).map(s => s.slice(1));

  function buildUrl() {
    let url = ep.path;
    for (const [k, v] of Object.entries(pathVars)) {
      url = url.replace(`:${k}`, encodeURIComponent(v || `<${k}>`));
    }
    return url;
  }

  async function send() {
    setRunning(true);
    setResult(null);
    setError(null);
    const t0 = performance.now();
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (ep.auth === "bearer" && token) headers["Authorization"] = `Bearer ${token}`;
      if (ep.auth === "api-key" && apiKey)  headers["X-System-API-Key"] = apiKey;
      const opts: RequestInit = { method: ep.method, headers };
      if (ep.method !== "GET" && ep.method !== "DELETE" && body.trim()) {
        try { opts.body = JSON.stringify(JSON.parse(body)); }
        catch { opts.body = body; }
      }
      const res = await fetch(buildUrl(), opts);
      const ms = Math.round(performance.now() - t0);
      let resBody: unknown;
      try { resBody = await res.json(); } catch { resBody = await res.text(); }
      setResult({ status: res.status, ok: res.ok, body: resBody, ms });
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    } catch (e: any) {
      setError(e.message ?? "Request failed");
    } finally {
      setRunning(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-violet-50 hover:border-violet-300 border-gray-200 text-gray-500 hover:text-violet-700"
      >
        <Play size={11} /> Try it out
      </button>
    );
  }

  const statusColor = result
    ? result.status < 300 ? "text-emerald-600" : result.status < 500 ? "text-amber-600" : "text-red-600"
    : "";

  return (
    <div className="border border-violet-200 bg-violet-50/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-violet-700 flex items-center gap-1.5"><Play size={11} /> Try it out</span>
        <button onClick={() => { setOpen(false); setResult(null); setError(null); }}
          className="text-[10px] text-gray-400 hover:text-gray-600">✕ Close</button>
      </div>

      {/* Auth input */}
      {ep.auth === "bearer" && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Bearer Token (JWT)</label>
          <input value={token} onChange={e => setToken(e.target.value)}
            placeholder="Paste your JWT token…"
            className="w-full h-8 px-2.5 text-xs font-mono border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400" />
        </div>
      )}
      {ep.auth === "api-key" && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">X-System-API-Key</label>
          <input value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="Paste your Parda API key…"
            className="w-full h-8 px-2.5 text-xs font-mono border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400" />
        </div>
      )}

      {/* Path params */}
      {pathParamNames.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {pathParamNames.map(name => (
            <div key={name}>
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">:{name}</label>
              <input value={pathVars[name] ?? ""} onChange={e => setPathVars(prev => ({ ...prev, [name]: e.target.value }))}
                placeholder={name}
                className="w-full h-8 px-2.5 text-xs font-mono border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400" />
            </div>
          ))}
        </div>
      )}

      {/* Request body */}
      {ep.method !== "GET" && ep.method !== "DELETE" && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Request Body (JSON)</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
            placeholder='{ "key": "value" }'
            className="w-full px-2.5 py-2 text-xs font-mono border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 resize-y" />
        </div>
      )}

      {/* URL preview */}
      <div className="flex items-center gap-2 text-[10px] text-gray-400">
        <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{ep.method} {buildUrl()}</span>
      </div>

      {/* Send button */}
      <button onClick={send} disabled={running}
        className="flex items-center gap-2 h-8 px-4 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition-all"
        style={{ background: BRAND }}>
        {running ? <><Loader2 size={12} className="animate-spin" /> Sending…</> : <><Play size={12} /> Send Request</>}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div ref={resultRef} className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className={`font-bold ${statusColor}`}>{result.status}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-400">{result.ms}ms</span>
          </div>
          <pre className={`text-xs rounded-lg px-4 py-3 overflow-x-auto leading-relaxed font-mono whitespace-pre ${result.ok ? "bg-gray-900 text-emerald-400" : "bg-red-950 text-red-300"}`}>
            {typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Endpoint card ────────────────────────────────────────────────────────────
function EndpointCard({ ep, sectionId, idx }: { ep: Endpoint; sectionId: string; idx: number }) {
  const [open, setOpen] = useState(false);
  const id = `${sectionId}-${idx}`;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${open ? "bg-gray-50" : "bg-white hover:bg-gray-50/70"}`}
      >
        <MethodBadge method={ep.method} />
        <code className="flex-1 text-sm font-mono text-gray-800">{ep.path}</code>
        <AuthBadge auth={ep.auth} />
        {open ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-2 bg-white border-t border-gray-50 space-y-4">
          <p className="text-sm text-gray-600">{ep.description}</p>

          {/* Auth info */}
          <div className="text-xs text-gray-500">
            {ep.auth === "bearer" && (
              <div className="flex items-center gap-2">
                <Lock size={11} />
                <span>Requires <code className="bg-gray-100 px-1 rounded">Authorization: Bearer &lt;token&gt;</code> header</span>
              </div>
            )}
            {ep.auth === "api-key" && (
              <div className="flex items-center gap-2">
                <Key size={11} />
                <span>Requires <code className="bg-gray-100 px-1 rounded">X-System-API-Key: &lt;key&gt;</code> header</span>
              </div>
            )}
            {ep.auth === "none" && (
              <div className="flex items-center gap-2 text-emerald-600">
                <Globe size={11} />
                <span>Public endpoint — no authentication required</span>
              </div>
            )}
          </div>

          {/* Parameters table */}
          {ep.params && ep.params.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Parameters</p>
              <div className="rounded-lg border border-gray-100 overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Name</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">In</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Type</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Req.</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {ep.params.map((p, i) => (
                      <tr key={i} className="bg-white">
                        <td className="px-3 py-2 font-mono text-gray-800">{p.name}</td>
                        <td className="px-3 py-2 text-gray-500">{p.in}</td>
                        <td className="px-3 py-2 text-gray-500">{p.type}</td>
                        <td className="px-3 py-2">{p.required ? <span className="text-red-500 font-bold">✓</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-gray-500">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request body example */}
          {ep.bodyExample && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Request Body (JSON)</p>
              <JsonBlock obj={ep.bodyExample} id={`${id}-req`} />
            </div>
          )}

          {/* Response example */}
          {ep.responseExample && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Example Response</p>
              <JsonBlock obj={ep.responseExample} id={`${id}-res`} />
            </div>
          )}

          {/* cURL example */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">cURL Example</p>
            <div className="relative group">
              <pre className="bg-gray-900 text-blue-300 text-xs rounded-lg px-4 py-3 overflow-x-auto font-mono whitespace-pre">
{`curl -X ${ep.method} ${BASE}${ep.path.replace(/:[a-z]+/g, "<id>")}${
  ep.auth === "bearer" ? ` \\\n  -H "Authorization: Bearer <your-token>"` : ""
}${
  ep.auth === "api-key" ? ` \\\n  -H "X-System-API-Key: <your-key>"` : ""
}${
  ep.bodyExample ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(ep.bodyExample)}'` : ""
}`}
              </pre>
            </div>
          </div>

          {/* Try it out */}
          <TryItOut ep={ep} />
        </div>
      )}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
function SectionCard({ section }: { section: Section }) {
  const [open, setOpen] = useState(true);
  const Icon = section.icon;
  return (
    <div id={section.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-6 py-4 border-b border-gray-50 hover:bg-gray-50/70 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${BRAND}18` }}>
          <Icon className="w-4 h-4" style={{ color: BRAND }} />
        </div>
        <div className="flex-1 text-left">
          <h2 className="font-semibold text-gray-800 text-sm">{section.title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{section.description}</p>
        </div>
        <span className="text-xs text-gray-400">{section.endpoints.length} endpoint{section.endpoints.length !== 1 ? "s" : ""}</span>
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
      </button>
      {open && (
        <div className="p-5 space-y-2.5">
          {section.endpoints.map((ep, i) => (
            <EndpointCard key={i} ep={ep} sectionId={section.id} idx={i} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── All sections / endpoints ─────────────────────────────────────────────────
const SECTIONS: Section[] = [
  {
    id: "auth",
    icon: Lock,
    title: "Authentication",
    description: "User registration, login, email verification, Google OAuth",
    endpoints: [
      {
        method: "POST", path: "/api/auth/register", auth: "none",
        description: "Create a new client account. Returns a JWT token. If email verification is enabled, the token is temporary until /verify-email is called.",
        params: [
          { name: "firstName", in: "body", type: "string", required: true,  description: "User's first name" },
          { name: "lastName",  in: "body", type: "string", required: true,  description: "User's last name" },
          { name: "email",     in: "body", type: "string", required: true,  description: "Email address (must be unique)" },
          { name: "password",  in: "body", type: "string", required: true,  description: "Min 8 characters" },
          { name: "country",   in: "body", type: "string", required: false, description: "ISO-3166-1 alpha-2 country code (e.g. US, PK, GB)" },
          { name: "billingCurrency", in: "body", type: "string", required: false, description: "3-letter currency code (e.g. USD, GBP)" },
          { name: "company",   in: "body", type: "string", required: false, description: "Company / organization name" },
          { name: "phone",     in: "body", type: "string", required: false, description: "Phone number" },
          { name: "refCode",   in: "body", type: "string", required: false, description: "Referral code from affiliate link" },
          { name: "captchaToken", in: "body", type: "string", required: false, description: "Cloudflare Turnstile token (if captcha is enabled)" },
        ],
        bodyExample: { firstName: "Jane", lastName: "Smith", email: "jane@example.com", password: "Secure123!", country: "US", billingCurrency: "USD" },
        responseExample: { token: "eyJhbGci...", requiresVerification: true, user: { id: "uuid", email: "jane@example.com", role: "client" } },
      },
      {
        method: "POST", path: "/api/auth/login", auth: "none",
        description: "Authenticate an existing user. Returns a JWT Bearer token valid for 30 days.",
        params: [
          { name: "email",    in: "body", type: "string", required: true, description: "Registered email address" },
          { name: "password", in: "body", type: "string", required: true, description: "Account password" },
        ],
        bodyExample: { email: "jane@example.com", password: "Secure123!" },
        responseExample: { token: "eyJhbGci...", user: { id: "uuid", firstName: "Jane", lastName: "Smith", role: "client", billingCurrency: "USD", country: "US" } },
      },
      {
        method: "POST", path: "/api/auth/verify-email", auth: "bearer",
        description: "Submit the 6-digit OTP sent to the user's email to activate the account. Use the temporary token from /register as the Bearer token.",
        params: [
          { name: "code", in: "body", type: "string", required: true, description: "6-digit verification code from email" },
        ],
        bodyExample: { code: "483920" },
        responseExample: { success: true, message: "Email verified successfully" },
      },
      {
        method: "GET", path: "/api/auth/me", auth: "bearer",
        description: "Return the currently authenticated user's profile including billing currency, country, and account balance.",
        responseExample: { id: "uuid", firstName: "Jane", lastName: "Smith", email: "jane@example.com", role: "client", country: "US", billingCurrency: "USD", creditBalance: "0.00" },
      },
      {
        method: "GET", path: "/api/auth/google/start", auth: "none",
        description: "Redirect the browser to Google OAuth consent page. Call this from a link or window.location.href — not fetch.",
      },
    ],
  },
  {
    id: "global",
    icon: Globe,
    title: "Global Config & Currency",
    description: "IP geolocation, exchange rates, currency detection for external websites",
    endpoints: [
      {
        method: "GET", path: "/api/global/config", auth: "none",
        description: "Returns the visitor's IP-detected country and currency, all active exchange rates, and rate cache freshness. Designed for external websites to call on page load (no API key required).",
        responseExample: {
          detectedCountry: "US",
          detectedCurrency: { code: "USD", symbol: "$", rate: 0.0036 },
          baseCurrency: { code: "PKR", symbol: "Rs." },
          currencies: [{ code: "USD", symbol: "$", exchangeRate: 0.0036, isDefault: false }],
          rateCache: { lastRefreshed: "2026-03-27T12:00:00Z", ageHours: 2.1, cacheFresh: true },
        },
      },
      {
        method: "GET", path: "/api/currencies", auth: "none",
        description: "Returns all active currencies with exchange rates. Used by the client portal to populate the currency switcher.",
        responseExample: [{ id: "uuid", code: "USD", name: "US Dollar", symbol: "$", exchangeRate: "0.0036", isDefault: false, isActive: true }],
      },
    ],
  },
  {
    id: "sync",
    icon: RefreshCw,
    title: "Sync API (Parda)",
    description: "Fetch live hosting plans, domain pricing, and currencies. Requires X-System-API-Key header.",
    endpoints: [
      {
        method: "GET", path: "/api/sync/plans", auth: "api-key",
        description: "Returns all active hosting plans with prices converted to the requested currency. Raw PKR prices are also included for Safepay integration.",
        params: [
          { name: "X-System-API-Key", in: "header", type: "string", required: true,  description: "Your Parda system API key" },
          { name: "currency",         in: "query",  type: "string", required: false, description: "3-letter currency code (defaults to PKR)" },
        ],
        responseExample: {
          currency: { code: "USD", symbol: "$", rate: 0.0036 },
          plans: [{
            id: "uuid", name: "Starter", prices: { monthly: 1.8, yearly: 19.44, renewal: 1.8, monthlyPkr: 500, yearlyPkr: 5400 },
          }],
          total: 1,
        },
      },
      {
        method: "GET", path: "/api/sync/domain-extensions", auth: "api-key",
        description: "Returns all active domain TLDs with registration, renewal, and transfer prices in the requested currency.",
        params: [
          { name: "X-System-API-Key", in: "header", type: "string", required: true,  description: "Your Parda system API key" },
          { name: "currency",         in: "query",  type: "string", required: false, description: "3-letter currency code" },
        ],
        responseExample: {
          currency: { code: "GBP", symbol: "£", rate: 0.0028 },
          extensions: [{ extension: ".com", prices: { register: 8.4, renewal: 8.4, transfer: 7.0, registerPkr: 3000 } }],
          total: 1,
        },
      },
      {
        method: "GET", path: "/api/sync/currencies", auth: "api-key",
        description: "Returns all active currencies and their exchange rates relative to PKR.",
        params: [{ name: "X-System-API-Key", in: "header", type: "string", required: true, description: "Your Parda system API key" }],
        responseExample: [{ code: "USD", symbol: "$", name: "US Dollar", exchangeRate: 0.0036, isDefault: false }],
      },
    ],
  },
  {
    id: "invoices",
    icon: FileText,
    title: "Invoices",
    description: "Create, view, and manage client invoices",
    endpoints: [
      {
        method: "GET", path: "/api/my/invoices", auth: "bearer",
        description: "Returns the authenticated client's invoice list (paginated, most recent first).",
        responseExample: { invoices: [{ id: "uuid", invoiceNumber: "INV-0001", total: "5000", status: "unpaid", currencyCode: "USD", currencySymbol: "$", currencyRate: "0.0036" }], total: 1 },
      },
      {
        method: "GET", path: "/api/my/invoices/:id", auth: "bearer",
        description: "Returns a single invoice with line items. The currencyCode/Symbol/Rate fields reflect the currency the invoice was generated in — use these for display, not the session currency.",
        responseExample: {
          id: "uuid", invoiceNumber: "INV-0001", total: "5000", amount: "5000", tax: "0",
          status: "unpaid", currencyCode: "USD", currencySymbol: "$", currencyRate: "0.0036",
          items: [{ description: "Starter Hosting — Monthly", quantity: 1, unitPrice: "500", total: "500" }],
        },
      },
      {
        method: "POST", path: "/api/admin/invoices", auth: "bearer",
        description: "Admin only. Create a new invoice for a client. Amounts are stored in PKR base.",
        params: [
          { name: "clientId",     in: "body", type: "string", required: true,  description: "UUID of the client" },
          { name: "items",        in: "body", type: "array",  required: true,  description: "Array of line items (description, quantity, unitPrice)" },
          { name: "dueDate",      in: "body", type: "string", required: false, description: "ISO date string for payment due date" },
          { name: "currencyCode", in: "body", type: "string", required: false, description: "Currency for display (default: client's billingCurrency)" },
        ],
      },
    ],
  },
  {
    id: "checkout",
    icon: CreditCard,
    title: "Checkout & Payments",
    description: "Order creation and Safepay payment flow",
    endpoints: [
      {
        method: "POST", path: "/api/checkout/create-session", auth: "bearer",
        description: "Creates a new order and invoice, then returns a Safepay payment URL. The client is redirected to Safepay's hosted checkout. All amounts are processed in PKR; the display currency is stored on the invoice for localized formatting.",
        params: [
          { name: "planId",   in: "body", type: "string", required: true,  description: "Hosting plan UUID" },
          { name: "cycle",    in: "body", type: "string", required: true,  description: "Billing cycle: monthly | quarterly | semiannual | yearly" },
          { name: "domainId", in: "body", type: "string", required: false, description: "Optional domain UUID to attach" },
        ],
        bodyExample: { planId: "uuid", cycle: "yearly" },
        responseExample: { sessionUrl: "https://gw.sandbox.safepay.pk/...", invoiceId: "uuid", pkrAmount: 5400, displayAmount: 19.44, displayCurrencyCode: "USD" },
      },
      {
        method: "GET", path: "/api/checkout/safepay/return", auth: "bearer",
        description: "Handles Safepay return redirect after payment. Verifies payment status and updates the invoice.",
      },
    ],
  },
  {
    id: "webhooks",
    icon: Webhook,
    title: "Webhooks",
    description: "Safepay payment notifications (server-to-server)",
    endpoints: [
      {
        method: "POST", path: "/api/webhooks/safepay", auth: "none",
        description: "Receives HMAC-SHA256-signed payment notifications from Safepay. The raw request body is used for signature verification. Configure this URL in your Safepay dashboard. Requests without a valid X-SFPY-SIGNATURE header are rejected with 401.",
        params: [
          { name: "X-SFPY-SIGNATURE", in: "header", type: "string", required: true, description: "HMAC-SHA256 signature computed by Safepay over the raw request body" },
        ],
        bodyExample: { type: "payment:created", data: { tracker: "abc123", status: "paid", amount: 5400 } },
        responseExample: { received: true },
      },
    ],
  },
  {
    id: "users",
    icon: Users,
    title: "User Management (Admin)",
    description: "Admin routes for managing clients",
    endpoints: [
      {
        method: "GET", path: "/api/admin/clients", auth: "bearer",
        description: "Admin only. Returns paginated list of all registered clients.",
        params: [
          { name: "page",   in: "query", type: "number", required: false, description: "Page number (default: 1)" },
          { name: "limit",  in: "query", type: "number", required: false, description: "Results per page (default: 20, max: 100)" },
          { name: "search", in: "query", type: "string", required: false, description: "Search by name or email" },
        ],
      },
      {
        method: "GET", path: "/api/admin/clients/:id", auth: "bearer",
        description: "Admin only. Returns full client profile including services, invoices, and credit balance.",
      },
      {
        method: "PUT", path: "/api/admin/clients/:id", auth: "bearer",
        description: "Admin only. Update client profile fields (name, email, company, phone, billingCurrency, country).",
        bodyExample: { firstName: "Jane", billingCurrency: "GBP", country: "GB" },
      },
    ],
  },
  {
    id: "currencies-admin",
    icon: Settings,
    title: "Currency Management (Admin)",
    description: "Manage active currencies and exchange rate cache",
    endpoints: [
      {
        method: "GET", path: "/api/admin/currencies/cache-status", auth: "bearer",
        description: "Returns exchange rate cache status: last refresh timestamp, age in hours, and time until next auto-refresh.",
        responseExample: { lastRefreshed: "2026-03-27T12:00:00Z", ageHours: 2.1, cacheFresh: true, nextRefreshInHours: 21.9 },
      },
      {
        method: "POST", path: "/api/admin/currencies/refresh-rates", auth: "bearer",
        description: "Force-refresh exchange rates from open.er-api.com, bypassing the 24-hour cache. Returns count of updated currencies.",
        responseExample: { updated: 8, errors: [], lastRefreshed: "2026-03-27T18:00:00Z" },
      },
      {
        method: "GET", path: "/api/admin/sync/key", auth: "bearer",
        description: "Returns the current Parda system API key for configuring external website integration.",
        responseExample: { apiKey: "80cdc125d76a47d6...", configured: true, usage: { header: "X-System-API-Key" } },
      },
      {
        method: "POST", path: "/api/admin/sync/rotate-key", auth: "bearer",
        description: "Generates and stores a new system API key. The old key is immediately invalidated. Update your website's environment variable after rotating.",
        responseExample: { success: true, apiKey: "newkey...", message: "Update your website configuration with the new key." },
      },
    ],
  },
  {
    id: "security",
    icon: Shield,
    title: "Security & Notifications",
    description: "WhatsApp alerts, captcha, and fraud protection",
    endpoints: [
      {
        method: "GET", path: "/api/security/captcha-config", auth: "none",
        description: "Returns captcha provider config (Cloudflare Turnstile) including which pages require it and the public siteKey.",
        responseExample: { enabledPages: { login: false, register: true }, provider: "turnstile", siteKey: "0x4AAA..." },
      },
      {
        method: "GET", path: "/api/whatsapp/status", auth: "bearer",
        description: "Admin only. Returns current WhatsApp session status (connected / disconnected).",
      },
    ],
  },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ApiDocs() {
  const { copy, copied } = useCopy();

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${BRAND}18` }}>
              <BookOpen className="w-4 h-4" style={{ color: BRAND }} />
            </div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">API Reference</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Noehost API Documentation</h1>
          <p className="text-sm text-gray-500 mt-1">
            The single source of truth for integrating with the Noehost platform. Base URL:{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-gray-700">{BASE}</code>
          </p>
        </div>
        <button
          onClick={() => copy(BASE, "base")}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"
        >
          {copied === "base" ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
          Copy base URL
        </button>
      </div>

      {/* Quick reference */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Content-Type", value: "application/json", icon: Settings },
          { label: "Auth Header",  value: "Authorization: Bearer", icon: Lock },
          { label: "Sync Header",  value: "X-System-API-Key", icon: Key },
          { label: "Rate Limit",   value: "60 req/min (public)", icon: Shield },
        ].map(item => (
          <div key={item.label} className="bg-gray-50 rounded-xl p-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{item.label}</div>
            <div className="text-xs font-mono text-gray-700 break-all">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Auth note */}
      <div className="flex items-start gap-3 px-4 py-3 bg-violet-50 border border-violet-100 rounded-xl text-sm text-violet-700">
        <Bell className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <strong>JWT tokens</strong> are returned by <code className="bg-violet-100 px-1 rounded text-xs">/api/auth/login</code> and{" "}
          <code className="bg-violet-100 px-1 rounded text-xs">/api/auth/register</code>. Send them as{" "}
          <code className="bg-violet-100 px-1 rounded text-xs">Authorization: Bearer &lt;token&gt;</code> on every authenticated request.
          Tokens expire after 30 days.
        </div>
      </div>

      {/* Quick nav */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map(s => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="text-xs px-3 py-1 rounded-full border border-gray-200 hover:border-violet-300 hover:text-violet-700 text-gray-500 transition-colors"
          >
            {s.title}
          </a>
        ))}
      </div>

      {/* Sections */}
      {SECTIONS.map(section => (
        <SectionCard key={section.id} section={section} />
      ))}

      {/* Footer note */}
      <div className="text-center text-xs text-gray-400 pb-4">
        All amounts stored in <strong className="text-gray-600">PKR (base currency)</strong>. Client-facing prices are multiplied
        by the stored <code className="bg-gray-100 px-1 rounded">currencyRate</code> for display. Payments settle in PKR via Safepay.
      </div>
    </div>
  );
}
