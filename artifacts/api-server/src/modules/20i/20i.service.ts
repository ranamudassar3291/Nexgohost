/**
 * 20i Module — Service layer
 * Direct axios calls using raw Authorization header and correct reseller base URL.
 */
import axios, { AxiosRequestConfig } from "axios";
import {
  twentyiCreateHosting,
  twentyiSuspend,
  twentyiUnsuspend,
  twentyiDelete,
  twentyiGetSSOUrl,
} from "../../lib/twenty-i.js";
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

// ─── Raw axios request ────────────────────────────────────────────────────────

async function apiRequest<T = any>(apiKey: string, method: string, path: string, data?: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers = {
    Authorization: apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  console.log(`[20i API] → ${method} ${url}`);
  console.log(`[20i API]   Authorization: ${apiKey.substring(0, 4)}****${apiKey.slice(-4)}  (len=${apiKey.length})`);
  console.log(`[20i API]   Headers:`, { Authorization: `${apiKey.substring(0, 4)}****`, "Content-Type": "application/json", Accept: "application/json" });

  const cfg: AxiosRequestConfig = {
    method: method as any,
    url,
    headers,
    data,
    timeout: 25000,
    validateStatus: () => true,
  };

  const res = await axios(cfg);

  console.log(`[20i API] ← HTTP ${res.status}  Response:`, JSON.stringify(res.data).substring(0, 300));

  if (res.status >= 200 && res.status < 300) return res.data as T;

  const err: any = new Error(`HTTP ${res.status}`);
  err.response = { status: res.status, data: res.data };
  throw err;
}

// ─── testConnection ───────────────────────────────────────────────────────────

export async function testConnection(apiKey: string): Promise<APIResponse<{ packageCount: number }>> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) {
    return { success: false, message: error!, errorType: "invalid_api_key" };
  }

  try {
    console.log("[20i] Testing connection...");

    // IP debug log
    console.log("Outgoing IP check...");
    try {
      const ip = await axios.get("https://api.ipify.org?format=json", { timeout: 5000 });
      console.log("Server IP:", ip.data.ip);
    } catch {
      console.log("Server IP: (could not detect)");
    }

    // Step 1: GET https://api.20i.com/reseller — verify auth
    await apiRequest(clean, "GET", "");

    // Step 2: GET https://api.20i.com/reseller/package — verify permissions
    const packages = await apiRequest(clean, "GET", "/package");

    return {
      success: true,
      message: "20i Connection Successful",
      data: {
        packageCount: Array.isArray(packages) ? packages.length : 0,
      },
    };
  } catch (err: any) {
    console.error("20i connection error:", err);
    const classified = classifyError(err);
    return {
      success: false,
      message: classified.message,
      errorType: classified.errorType,
    };
  }
}

// ─── getPackages ──────────────────────────────────────────────────────────────

export async function getPackages(apiKey: string): Promise<APIResponse<Package[]>> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  try {
    const pkgs = await apiRequest<any[]>(clean, "GET", "/package");
    const list: Package[] = Array.isArray(pkgs) ? pkgs.map(p => ({
      id: String(p.id ?? p.name),
      name: p.name ?? "Unnamed",
      diskSpaceMb: p.diskSpace,
      bandwidthGb: p.bandwidth,
      emailBoxes: p.mailboxes,
      databases: p.databases,
      subdomains: p.subdomains,
    })) : [];
    console.log(`[20i API] ← ${list.length} packages found`);
    return { success: true, message: `${list.length} package(s) found`, data: list };
  } catch (err: any) {
    const classified = classifyError(err);
    return { success: false, message: classified.message, errorType: classified.errorType };
  }
}

// ─── getAccounts ──────────────────────────────────────────────────────────────

export async function getAccounts(apiKey: string): Promise<APIResponse<HostingAccount[]>> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  try {
    const sites = await apiRequest<any[]>(clean, "GET", "/web");
    const accounts: HostingAccount[] = Array.isArray(sites) ? sites.map(s => ({
      id: String(s.id),
      name: s.name ?? s.domain ?? String(s.id),
      domain: s.domain ?? s.name ?? String(s.id),
      status: s.active === false ? "suspended" : "active",
      packageId: s.type?.package,
    })) : [];
    console.log(`[20i API] ← ${accounts.length} accounts found`);
    return { success: true, message: `${accounts.length} account(s) found`, data: accounts };
  } catch (err: any) {
    const classified = classifyError(err);
    return { success: false, message: classified.message, errorType: classified.errorType };
  }
}

// ─── createAccount ────────────────────────────────────────────────────────────

export async function createAccount(apiKey: string, params: CreateHostingParams): Promise<CreateHostingResult> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error! };

  const { domain, email, packageId, stackUserId } = params;
  if (!domain) return { success: false, message: "domain is required" };
  if (!email) return { success: false, message: "email is required" };

  console.log(`[20i API] → Creating hosting for ${domain} (${email})  pkg=${packageId ?? "default"}`);

  try {
    const result = await twentyiCreateHosting(clean, domain, email, packageId, stackUserId);
    console.log(`[20i API] ← Hosting created — siteId=${result.siteId}`);
    return {
      success: true,
      message: `Hosting account created for ${domain}`,
      siteId: result.siteId,
      cpanelUrl: result.cpanelUrl,
      webmailUrl: result.webmailUrl,
    };
  } catch (err: any) {
    console.error(`[20i API] Error creating account:`, err.message);
    const classified = classifyError(err);
    return { success: false, message: classified.message };
  }
}

// ─── suspendAccount ───────────────────────────────────────────────────────────

export async function suspendAccount(apiKey: string, siteId: string): Promise<APIResponse> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  console.log(`[20i API] → Suspending site ${siteId}`);
  try {
    await twentyiSuspend(clean, siteId);
    console.log(`[20i API] ← Site ${siteId} suspended`);
    return { success: true, message: `Account ${siteId} suspended` };
  } catch (err: any) {
    const classified = classifyError(err);
    return { success: false, message: classified.message, errorType: classified.errorType };
  }
}

// ─── unsuspendAccount ─────────────────────────────────────────────────────────

export async function unsuspendAccount(apiKey: string, siteId: string): Promise<APIResponse> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  console.log(`[20i API] → Unsuspending site ${siteId}`);
  try {
    await twentyiUnsuspend(clean, siteId);
    console.log(`[20i API] ← Site ${siteId} unsuspended`);
    return { success: true, message: `Account ${siteId} unsuspended` };
  } catch (err: any) {
    const classified = classifyError(err);
    return { success: false, message: classified.message, errorType: classified.errorType };
  }
}

// ─── terminateAccount ─────────────────────────────────────────────────────────

export async function terminateAccount(apiKey: string, siteId: string): Promise<APIResponse> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  console.log(`[20i API] → Terminating site ${siteId}`);
  try {
    await twentyiDelete(clean, siteId);
    console.log(`[20i API] ← Site ${siteId} terminated`);
    return { success: true, message: `Account ${siteId} terminated` };
  } catch (err: any) {
    const classified = classifyError(err);
    return { success: false, message: classified.message, errorType: classified.errorType };
  }
}

// ─── changePackage ────────────────────────────────────────────────────────────

export async function changePackage(apiKey: string, siteId: string, newPackageId: string): Promise<APIResponse> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  console.log(`[20i API] → Changing package for site ${siteId} → ${newPackageId}`);
  try {
    // Correct endpoint: POST https://api.20i.com/reseller/web/{siteId}/package
    await apiRequest(clean, "POST", `/web/${siteId}/package`, { packageId: newPackageId });
    console.log(`[20i API] ← Package changed for site ${siteId}`);
    return { success: true, message: `Package changed to ${newPackageId}` };
  } catch (err: any) {
    const classified = classifyError(err);
    return { success: false, message: classified.message, errorType: classified.errorType };
  }
}

// ─── singleSignOn ─────────────────────────────────────────────────────────────

export async function singleSignOn(apiKey: string, siteId: string): Promise<SSOResult> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error! };

  console.log(`[20i API] → Getting SSO URL for site ${siteId}`);
  try {
    const url = await twentyiGetSSOUrl(clean, siteId);
    console.log(`[20i API] ← SSO URL obtained`);
    return { success: true, message: "SSO URL generated", url };
  } catch (err: any) {
    const classified = classifyError(err);
    return { success: false, message: classified.message };
  }
}

// ─── addServer (test + return server config) ──────────────────────────────────

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
    return {
      success: false,
      message: testResult.message,
      errorType: testResult.errorType,
      error: testResult.message,
    };
  }

  const apiKeyPreview = `${clean.substring(0, 4)}...${clean.slice(-4)}`;
  console.log(`[20i] ✓ 20i Server Connected — name="${name}"  packages=${testResult.data?.packageCount ?? 0}`);

  return {
    success: true,
    message: "20i Server Connected",
    data: {
      name,
      apiKeyPreview,
      packageCount: testResult.data?.packageCount ?? 0,
    },
  };
}
