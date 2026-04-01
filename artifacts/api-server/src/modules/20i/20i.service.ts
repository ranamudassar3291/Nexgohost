/**
 * 20i Module — Service layer
 * All functions use axios with raw Bearer auth per 20i Reseller API spec.
 * Delegates to lib/twenty-i.ts for complex operations (provisioning, SSO, etc.)
 */
import axios, { AxiosRequestConfig } from "axios";
import {
  twentyiTestConnection,
  twentyiCreateHosting,
  twentyiSuspend,
  twentyiUnsuspend,
  twentyiDelete,
  twentyiGetPackages,
  twentyiListSites,
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

const BASE_URL = "https://api.20i.com/reseller";

// ─── Raw axios request ────────────────────────────────────────────────────────

async function apiRequest<T = any>(apiKey: string, method: string, path: string, data?: unknown): Promise<T> {
  const url = `https://api.20i.com${path}`;
  const cfg: AxiosRequestConfig = {
    method: method as any,
    url,
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    data,
    timeout: 25000,
    validateStatus: () => true,
  };

  console.log(`[20i API] → ${method} ${url}`);
  console.log(`[20i API]   X-API-KEY: ${apiKey.substring(0, 4)}****${apiKey.slice(-4)}  (len=${apiKey.length})`);
  console.log(`[20i API]   Headers:`, { "X-API-KEY": `${apiKey.substring(0, 4)}****`, "Content-Type": "application/json", Accept: "application/json" });

  const res = await axios(cfg);

  console.log(`[20i API] ← HTTP ${res.status}  Response:`, JSON.stringify(res.data).substring(0, 300));

  if (res.status >= 200 && res.status < 300) return res.data as T;

  const err: any = new Error(`HTTP ${res.status}`);
  err.response = { status: res.status, data: res.data };
  throw err;
}

// ─── testConnection ───────────────────────────────────────────────────────────

/**
 * Test the 20i Reseller API connection.
 * Step 1: GET /reseller — verify auth
 * Step 2: GET packages — verify permissions
 */
export async function testConnection(apiKey: string): Promise<APIResponse<{ packageCount: number }>> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  console.log(`[20i] testConnection — key_len=${clean.length}  last4=${clean.slice(-4)}`);

  try {
    const result = await twentyiTestConnection(clean);
    if (!result.success) {
      const { errorType } = classifyError({ response: { status: result.message.includes("401") ? 401 : 403 } });
      return {
        success: false,
        message: result.message,
        errorType: result.message.includes("401") ? "ip_not_whitelisted" : errorType,
        data: { packageCount: 0 },
      };
    }
    return {
      success: true,
      message: result.message,
      data: { packageCount: result.packageCount ?? 0 },
    };
  } catch (err: any) {
    console.error(`[20i] testConnection error:`, err);
    const classified = classifyError(err);
    return { success: false, message: classified.message, errorType: classified.errorType, httpStatus: classified.httpStatus };
  }
}

// ─── getPackages ──────────────────────────────────────────────────────────────

export async function getPackages(apiKey: string): Promise<APIResponse<Package[]>> {
  const { valid, clean, error } = validateApiKey(apiKey);
  if (!valid) return { success: false, message: error!, errorType: "invalid_api_key" };

  try {
    console.log("[20i API] → GET /reseller/package (packages)");
    const pkgs = await twentyiGetPackages(clean);
    console.log(`[20i API] ← ${pkgs.length} packages found`);
    return { success: true, message: `${pkgs.length} package(s) found`, data: pkgs };
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
    console.log("[20i API] → GET /reseller/web (accounts)");
    const sites = await twentyiListSites(clean);
    console.log(`[20i API] ← ${sites.length} accounts found`);
    const accounts: HostingAccount[] = sites.map(s => ({
      id: s.id,
      name: s.name,
      domain: s.domain ?? s.name,
      status: s.status ?? "active",
      packageId: s.packageId,
    }));
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
    await apiRequest(clean, "POST", `/userHosting/${siteId}/updatePackage`, { package_id: newPackageId });
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

  // Step 1: Test connection
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

  // Step 2: Return success (caller is responsible for DB persistence)
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
