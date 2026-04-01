/**
 * 20i Module — Service layer
 * All calls use X-API-KEY header. Zero lib delegation — pure axios.
 * BASE_URL: https://api.20i.com/reseller/v1
 */
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

// ─── Base URL ─────────────────────────────────────────────────────────────────

const BASE_URL = "https://api.20i.com/reseller/v1";

// ─── Core axios request ───────────────────────────────────────────────────────

async function apiRequest<T = any>(apiKey: string, method: string, path: string, data?: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const headers = {
    "X-API-KEY": apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Debug logs
  console.log("20i API Call");
  console.log("URL:", url);
  console.log("20i API KEY:", apiKey.substring(0, 4) + "****" + apiKey.slice(-4) + "  (len=" + apiKey.length + ")");
  console.log("Headers:", { ...headers, "X-API-KEY": apiKey.substring(0, 4) + "****" + apiKey.slice(-4) });

  const cfg: AxiosRequestConfig = {
    method: method as any,
    url,
    headers,
    data,
    timeout: 25000,
    validateStatus: () => true,
  };

  const res = await axios(cfg);

  console.log("Response:", JSON.stringify(res.data).substring(0, 400));

  if (res.status >= 200 && res.status < 300) return res.data as T;

  const err: any = new Error(`HTTP ${res.status}`);
  err.response = { status: res.status, data: res.data };
  throw err;
}

// ─── testConnection ───────────────────────────────────────────────────────────

export async function testConnection(apiKey: string): Promise<APIResponse<{ packageCount: number }>> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  try {
    console.log("[20i] Testing connection...");

    // IP debug
    console.log("Outgoing IP check...");
    try {
      const ip = await axios.get("https://api.ipify.org?format=json", { timeout: 5000 });
      console.log("Server IP:", ip.data.ip);
    } catch {
      console.log("Server IP: (detection failed)");
    }

    // Step 1: GET https://api.20i.com/reseller/v1/reseller
    await apiRequest(clean, "GET", "/reseller");

    // Step 2: GET https://api.20i.com/reseller/v1/package
    const packages = await apiRequest(clean, "GET", "/package");

    console.log("[20i] Connection test SUCCESS — packages:", Array.isArray(packages) ? packages.length : 0);

    return {
      success: true,
      message: "Connected Successfully",
      data: { packageCount: Array.isArray(packages) ? packages.length : 0 },
    };
  } catch (err: any) {
    console.error("20i connection error:", err?.message);
    const classified = classifyError(err);
    return { success: false, message: classified.message, errorType: classified.errorType };
  }
}

// ─── getPackages ──────────────────────────────────────────────────────────────

export async function getPackages(apiKey: string): Promise<APIResponse<Package[]>> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  try {
    const raw = await apiRequest<any[]>(clean, "GET", "/package");
    const pkgs: Package[] = Array.isArray(raw) ? raw.map(p => ({
      id: String(p.id ?? p.name ?? ""),
      name: p.name ?? "Unnamed",
      diskSpaceMb: p.diskSpace,
      bandwidthGb: p.bandwidth,
      emailBoxes: p.mailboxes,
      databases: p.databases,
      subdomains: p.subdomains,
    })) : [];
    console.log("[20i]", pkgs.length, "packages found");
    return { success: true, message: `${pkgs.length} package(s) found`, data: pkgs };
  } catch (err: any) {
    const c = classifyError(err);
    return { success: false, message: c.message, errorType: c.errorType };
  }
}

// ─── getAccounts ──────────────────────────────────────────────────────────────

export async function getAccounts(apiKey: string): Promise<APIResponse<HostingAccount[]>> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  try {
    const raw = await apiRequest<any[]>(clean, "GET", "/web");
    const accounts: HostingAccount[] = Array.isArray(raw) ? raw.map(s => ({
      id: String(s.id),
      name: s.name ?? String(s.id),
      domain: s.domain ?? s.name ?? String(s.id),
      status: s.active === false ? "suspended" : "active",
      packageId: s.type?.package,
    })) : [];
    console.log("[20i]", accounts.length, "accounts found");
    return { success: true, message: `${accounts.length} account(s) found`, data: accounts };
  } catch (err: any) {
    const c = classifyError(err);
    return { success: false, message: c.message, errorType: c.errorType };
  }
}

// ─── createAccount ────────────────────────────────────────────────────────────

export async function createAccount(apiKey: string, params: CreateHostingParams): Promise<CreateHostingResult> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error! };

  const { domain, email, packageId } = params;
  if (!domain) return { success: false, message: "domain is required" };
  if (!email) return { success: false, message: "email is required" };

  console.log(`[20i] Creating hosting for ${domain} (${email})  pkg=${packageId ?? "default"}`);

  try {
    const body: Record<string, any> = { domain, email };
    if (packageId) body.packageBundleTypes = [packageId];

    const result = await apiRequest<any>(clean, "POST", "/web", body);
    const siteId = result?.id ?? result?.hosting_id ?? null;

    console.log("[20i] Hosting created — siteId:", siteId);
    return { success: true, message: `Hosting account created for ${domain}`, siteId };
  } catch (err: any) {
    console.error("[20i] Error creating account:", err.message);
    const c = classifyError(err);
    return { success: false, message: c.message };
  }
}

// ─── suspendAccount ───────────────────────────────────────────────────────────

export async function suspendAccount(apiKey: string, siteId: string): Promise<APIResponse> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  console.log(`[20i] Suspending site ${siteId}`);
  try {
    await apiRequest(clean, "POST", `/web/${siteId}/suspend`, {});
    console.log(`[20i] Site ${siteId} suspended`);
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

  console.log(`[20i] Unsuspending site ${siteId}`);
  try {
    await apiRequest(clean, "POST", `/web/${siteId}/unsuspend`, {});
    console.log(`[20i] Site ${siteId} unsuspended`);
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

  console.log(`[20i] Terminating site ${siteId}`);
  try {
    await apiRequest(clean, "DELETE", `/web/${siteId}`, {});
    console.log(`[20i] Site ${siteId} terminated`);
    return { success: true, message: `Account ${siteId} terminated` };
  } catch (err: any) {
    const c = classifyError(err);
    return { success: false, message: c.message, errorType: c.errorType };
  }
}

// ─── changePackage ────────────────────────────────────────────────────────────

export async function changePackage(apiKey: string, siteId: string, newPackageId: string): Promise<APIResponse> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  console.log(`[20i] Changing package for site ${siteId} → ${newPackageId}`);
  try {
    await apiRequest(clean, "POST", `/web/${siteId}/package`, { packageId: newPackageId });
    console.log(`[20i] Package changed for site ${siteId}`);
    return { success: true, message: `Package changed to ${newPackageId}` };
  } catch (err: any) {
    const c = classifyError(err);
    return { success: false, message: c.message, errorType: c.errorType };
  }
}

// ─── singleSignOn ─────────────────────────────────────────────────────────────

export async function singleSignOn(apiKey: string, siteId: string): Promise<SSOResult> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error! };

  console.log(`[20i] Getting SSO URL for site ${siteId}`);
  try {
    const result = await apiRequest<any>(clean, "GET", `/web/${siteId}/login`);
    const url = result?.url ?? result?.loginUrl ?? result?.sso_url ?? null;
    console.log("[20i] SSO URL obtained");
    return { success: true, message: "SSO URL generated", url };
  } catch (err: any) {
    const c = classifyError(err);
    return { success: false, message: c.message };
  }
}

// ─── addServer (test + config return) ────────────────────────────────────────

export async function addServer(config: ServerConfig): Promise<APIResponse<{ name: string; apiKeyPreview: string; packageCount: number }>> {
  const { name, apiKey } = config;
  if (!name?.trim()) return { success: false, message: "Server name is required" };

  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  console.log(`[20i] addServer — name="${name}"  key_len=${clean.length}  last4=${clean.slice(-4)}`);
  console.log("[20i] Step 1: Testing connection…");

  const testResult = await testConnection(clean);
  console.log(`[20i] Test result: success=${testResult.success}  message=${testResult.message}`);

  if (!testResult.success) {
    return { success: false, message: testResult.message, errorType: testResult.errorType, error: testResult.message };
  }

  const apiKeyPreview = `${clean.substring(0, 4)}...${clean.slice(-4)}`;
  console.log(`[20i] ✓ Connected — name="${name}"  packages=${testResult.data?.packageCount ?? 0}`);

  return {
    success: true,
    message: "20i Server Connected",
    data: { name, apiKeyPreview, packageCount: testResult.data?.packageCount ?? 0 },
  };
}
