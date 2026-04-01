// 20i Reseller API - Service layer
// Auth: Authorization: Bearer Base64(apiKey)  [required by official 20i docs]
// Base URL: https://api.20i.com
// Reseller self-reference: use * in URL paths
// Endpoints:
//   GET  /reseller/*/packageCount  - test connection
//   GET  /reseller/*/packageTypes  - list package types
//   GET  /package                  - list all accounts
//   POST /reseller/*/addWeb        - create hosting
//   POST /reseller/*/deleteWeb     - delete hosting
//   POST /package/{id}/userStatus  - suspend or unsuspend
import axios, { AxiosRequestConfig } from "axios";
import { validateApiKey, classifyError } from "./20i.utils.js";
import type {
  ServerConfig,
  HostingAccount,
  Package,
  APIResponse,
  CreateHostingParams,
  CreateHostingResult,
  SSOResult,
} from "./20i.types.js";

const BASE = "https://api.20i.com";

// ─── Base64-encode the API key (REQUIRED by 20i docs) ────────────────────────

function encodeKey(raw: string): string {
  return Buffer.from(raw).toString("base64");
}

// ─── Core HTTP helper ─────────────────────────────────────────────────────────

async function apiRequest<T = any>(
  rawKey: string,
  method: string,
  path: string,
  data?: unknown
): Promise<T> {
  const token = encodeKey(rawKey);
  const url = `${BASE}${path}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  console.log("20i API →", method, url);
  console.log(
    "20i KEY (raw):",
    `${rawKey.substring(0, 4)}****${rawKey.slice(-4)} (len=${rawKey.length})`
  );
  console.log(
    "20i KEY (b64):",
    `${token.substring(0, 8)}... (len=${token.length})`
  );

  const cfg: AxiosRequestConfig = {
    method: method as any,
    url,
    headers,
    data,
    timeout: 25000,
    validateStatus: () => true,
  };

  const res = await axios(cfg);
  const bodyStr = JSON.stringify(res.data).substring(0, 400);
  console.log(`20i API ← HTTP ${res.status}  body=${bodyStr}`);

  if (res.status >= 200 && res.status < 300) return res.data as T;

  const err: any = new Error(`HTTP ${res.status}`);
  err.response = { status: res.status, data: res.data };
  throw err;
}

// ─── testConnection ───────────────────────────────────────────────────────────

export async function testConnection(
  apiKey: string
): Promise<APIResponse<{ packageCount: number }>> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  // Detect outgoing IP
  try {
    const ip = await axios.get("https://api.ipify.org?format=json", { timeout: 5000 });
    console.log(
      `20i Server IP: ${ip.data.ip}  ← must be whitelisted at my.20i.com → Reseller API → IP Whitelist`
    );
  } catch {
    console.log("20i Server IP: (detection failed)");
  }

  try {
    // GET /reseller/*/packageCount  — lightest possible test endpoint
    const counts = await apiRequest<{ linux?: number; windows?: number; wordpress?: number }>(
      clean, "GET", "/reseller/*/packageCount"
    );
    const total =
      (counts?.linux ?? 0) + (counts?.windows ?? 0) + (counts?.wordpress ?? 0);
    console.log("[20i] ✓ Connection test SUCCESS — package counts:", counts);
    return {
      success: true,
      message: "Connected Successfully",
      data: { packageCount: total },
    };
  } catch (err: any) {
    console.error("[20i] ✗ Connection test FAILED:", err?.message);
    const c = classifyError(err);
    return { success: false, message: c.message, errorType: c.errorType };
  }
}

// ─── getPackages (package types) ──────────────────────────────────────────────

export async function getPackages(apiKey: string): Promise<APIResponse<Package[]>> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  try {
    // GET /reseller/*/packageTypes
    const raw = await apiRequest<any[]>(clean, "GET", "/reseller/*/packageTypes");
    const pkgs: Package[] = Array.isArray(raw)
      ? raw.map((p) => ({
          id: String(p.id ?? ""),
          name: p.label ?? p.name ?? "Unnamed",
          platform: p.platform,
          diskSpaceMb: p.limits?.diskSpace,
          bandwidthGb: p.limits?.bandwidth,
          emailBoxes: p.limits?.mailboxes,
          databases: p.limits?.databases,
          subdomains: p.limits?.subdomains,
        }))
      : [];
    console.log(`[20i] ${pkgs.length} package types found`);
    return { success: true, message: `${pkgs.length} package type(s) found`, data: pkgs };
  } catch (err: any) {
    const c = classifyError(err);
    return { success: false, message: c.message, errorType: c.errorType };
  }
}

// ─── getAccounts (list all hosting packages) ──────────────────────────────────

export async function getAccounts(apiKey: string): Promise<APIResponse<HostingAccount[]>> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  try {
    // GET /package  — returns all packages for the reseller
    const raw = await apiRequest<any[]>(clean, "GET", "/package");
    const accounts: HostingAccount[] = Array.isArray(raw)
      ? raw.map((p) => ({
          id: String(p.id),
          name: p.name ?? String(p.id),
          domain: p.name ?? String(p.id),
          status: p.enabled === false ? "suspended" : "active",
          packageId: p.typeRef ?? p.packageTypeName,
          packageTypeName: p.packageTypeName,
          platform: p.packageTypePlatform,
          created: p.created,
        }))
      : [];
    console.log(`[20i] ${accounts.length} hosting accounts found`);
    return { success: true, message: `${accounts.length} account(s) found`, data: accounts };
  } catch (err: any) {
    const c = classifyError(err);
    return { success: false, message: c.message, errorType: c.errorType };
  }
}

// ─── createAccount ────────────────────────────────────────────────────────────

export async function createAccount(
  apiKey: string,
  params: CreateHostingParams
): Promise<CreateHostingResult> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error! };

  const { domain, email, packageId, label } = params;
  if (!domain) return { success: false, message: "domain is required" };
  if (!packageId) return { success: false, message: "packageId (type) is required" };

  console.log(`[20i] Creating hosting for ${domain} (packageId=${packageId})`);

  try {
    // POST /reseller/*/addWeb
    const body = {
      type: packageId,
      domain_name: domain,
      label: label ?? domain,
      documentRoots: { [domain]: "public_html" },
      ...(email ? { stackUser: null } : {}),
    };
    const result = await apiRequest<any>(clean, "POST", "/reseller/*/addWeb", body);
    // Response is the new package ID (integer)
    const siteId = typeof result === "number" ? String(result) : result?.id ?? null;
    console.log("[20i] Hosting created — siteId:", siteId);
    return { success: true, message: `Hosting created for ${domain}`, siteId };
  } catch (err: any) {
    const c = classifyError(err);
    return { success: false, message: c.message };
  }
}

// ─── suspendAccount ───────────────────────────────────────────────────────────

export async function suspendAccount(apiKey: string, siteId: string): Promise<APIResponse> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  console.log(`[20i] Suspending package ${siteId}`);
  try {
    // POST /package/{packageId}/userStatus  — subservices.default: false = suspend
    await apiRequest(clean, "POST", `/package/${siteId}/userStatus`, {
      includeRepeated: false,
      subservices: { default: false },
    });
    return { success: true, message: `Account ${siteId} suspended` };
  } catch (err: any) {
    const c = classifyError(err);
    return { success: false, message: c.message, errorType: c.errorType };
  }
}

// ─── unsuspendAccount ─────────────────────────────────────────────────────────

export async function unsuspendAccount(apiKey: string, siteId: string): Promise<APIResponse> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  console.log(`[20i] Unsuspending package ${siteId}`);
  try {
    // POST /package/{packageId}/userStatus  — includeRepeated: true + default: true = unsuspend
    await apiRequest(clean, "POST", `/package/${siteId}/userStatus`, {
      includeRepeated: true,
      subservices: { default: true },
    });
    return { success: true, message: `Account ${siteId} unsuspended` };
  } catch (err: any) {
    const c = classifyError(err);
    return { success: false, message: c.message, errorType: c.errorType };
  }
}

// ─── terminateAccount ─────────────────────────────────────────────────────────

export async function terminateAccount(apiKey: string, siteId: string): Promise<APIResponse> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  console.log(`[20i] Deleting package ${siteId}`);
  try {
    // POST /reseller/*/deleteWeb  — body: {"delete-id": [id]}
    await apiRequest(clean, "POST", "/reseller/*/deleteWeb", { "delete-id": [siteId] });
    return { success: true, message: `Account ${siteId} terminated` };
  } catch (err: any) {
    const c = classifyError(err);
    return { success: false, message: c.message, errorType: c.errorType };
  }
}

// ─── changePackage ────────────────────────────────────────────────────────────

export async function changePackage(
  apiKey: string,
  siteId: string,
  newPackageId: string
): Promise<APIResponse> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  console.log(`[20i] Changing package type for site ${siteId} → ${newPackageId}`);
  try {
    // POST /reseller/*/updateWebType
    await apiRequest(clean, "POST", "/reseller/*/updateWebType", {
      "package-id": siteId,
      type: newPackageId,
    });
    return { success: true, message: `Package type changed to ${newPackageId}` };
  } catch (err: any) {
    const c = classifyError(err);
    return { success: false, message: c.message, errorType: c.errorType };
  }
}

// ─── singleSignOn ─────────────────────────────────────────────────────────────

export async function singleSignOn(apiKey: string, siteId: string): Promise<SSOResult> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error! };

  console.log(`[20i] Getting SSO for package ${siteId}`);
  try {
    // POST /package/{packageId}/web/userToken  — generates a login token
    const result = await apiRequest<any>(
      clean, "POST", `/package/${siteId}/web/userToken`, {}
    );
    // Build the StackCP login URL with the returned token
    const token = result?.token ?? result?.loginToken ?? result?.userToken ?? null;
    const url = token
      ? `https://my.20i.com/cp/login/${token}`
      : result?.url ?? null;
    return { success: true, message: "SSO URL generated", url };
  } catch (err: any) {
    const c = classifyError(err);
    return { success: false, message: c.message };
  }
}

// ─── addServer ────────────────────────────────────────────────────────────────

export async function addServer(
  config: ServerConfig
): Promise<APIResponse<{ name: string; apiKeyPreview: string; packageCount: number }>> {
  const { name, apiKey } = config;
  if (!name?.trim()) return { success: false, message: "Server name is required" };

  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  console.log(
    `[20i] addServer — name="${name}"  key_len=${clean.length}  last4=${clean.slice(-4)}`
  );

  const testResult = await testConnection(clean);
  if (!testResult.success) {
    return {
      success: false,
      message: testResult.message,
      errorType: testResult.errorType,
      error: testResult.message,
    };
  }

  const apiKeyPreview = `${clean.substring(0, 4)}...${clean.slice(-4)}`;
  return {
    success: true,
    message: "20i Server Connected",
    data: { name, apiKeyPreview, packageCount: testResult.data?.packageCount ?? 0 },
  };
}
