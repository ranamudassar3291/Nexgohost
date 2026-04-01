/**
 * 20i Module — TypeScript type definitions
 */

// ─── Server / connection ──────────────────────────────────────────────────────

export interface ServerConfig {
  name: string;
  apiKey: string;
  baseUrl?: string;      // defaults to https://api.20i.com/reseller
  timeoutMs?: number;    // defaults to 25000
}

// ─── Hosting account ──────────────────────────────────────────────────────────

export interface HostingAccount {
  id: string;
  name: string;
  domain: string;
  status: "active" | "suspended" | "terminated" | string;
  packageId?: string;
  packageName?: string;
  stackUserId?: string;
  createdAt?: string;
}

// ─── Package ──────────────────────────────────────────────────────────────────

export interface Package {
  id: string;
  name: string;
  diskSpaceMb?: number;
  bandwidthGb?: number;
  emailBoxes?: number;
  databases?: number;
  subdomains?: number;
  price?: number;
}

// ─── API response wrapper ─────────────────────────────────────────────────────

export interface APIResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errorType?: "invalid_api_key" | "ip_not_whitelisted" | "not_found" | "rate_limited" | "server_error" | "network_error" | "unknown";
  httpStatus?: number;
}

// ─── Add server result ────────────────────────────────────────────────────────

export interface AddServerResult {
  success: boolean;
  message: string;
  serverId?: string;
  packageCount?: number;
}

// ─── Create hosting params ────────────────────────────────────────────────────

export interface CreateHostingParams {
  domain: string;
  email: string;
  packageId?: string;
  stackUserId?: string;
}

export interface CreateHostingResult {
  success: boolean;
  message: string;
  siteId?: string | null;
  cpanelUrl?: string;
  webmailUrl?: string;
}

// ─── SSO result ───────────────────────────────────────────────────────────────

export interface SSOResult {
  success: boolean;
  url?: string;
  message: string;
}
