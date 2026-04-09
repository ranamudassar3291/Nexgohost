/**
 * 20i Reseller Operations
 * Endpoints under /reseller/* — reseller account info, packages, sites
 */

import { TwentyIClient } from "./client.js";
import type {
  TwentyIPackageType,
  TwentyISite,
  TwentyIPackageCount,
  TwentyIResellerInfo,
  TwentyIConnectionResult,
  TwentyICreateWebOptions,
  TwentyICreateWebResult,
} from "./types.js";
import { TwentyIAuthError } from "./client.js";

// ─── Connection Test ─────────────────────────────────────────────────────────

/**
 * Test the API connection by calling /reseller/{reseller}/packageCount.
 * Returns a structured result with diagnosis information.
 */
export async function testConnection(client: TwentyIClient): Promise<TwentyIConnectionResult> {
  try {
    const data = await client.get<TwentyIPackageCount>("/reseller/*/packageCount");
    const d = data as unknown as Record<string, unknown>;
    const count = typeof d === "object" && d !== null
      ? Number(d.count ?? d.result ?? 0)
      : 0;
    return {
      success: true,
      message: `Connected successfully — ${count} package(s) on this account`,
      packageCount: count,
      diagnosis: "connected",
      diagnostic: {
        endpoint: "GET https://api.20i.com/reseller/{reseller}/packageCount",
        status: 200,
      },
    };
  } catch (err) {
    if (err instanceof TwentyIAuthError) {
      if (err.reason === "wrong_key") {
        return {
          success: false,
          message: "401 — KEY NOT RECOGNISED. This API key does not match any 20i reseller account. " +
            "Copy the exact General API Key from my.20i.com → Reseller API → API Keys.",
          diagnosis: "wrong_key",
          diagnostic: { detail: "20i returned {\"type\":\"User ID\"}. The key does not match any account.", status: 401 },
        };
      }
      if (err.reason === "ip_blocked" || err.reason === "forbidden") {
        return {
          success: false,
          message: "403 — Access denied. Check your API key or package configuration at my.20i.com → Reseller API.",
          diagnosis: "ip_blocked",
          diagnostic: { detail: err.message, status: 403 },
        };
      }
      return {
        success: false,
        message: err.message,
        diagnosis: "unknown_401",
        diagnostic: { status: err.statusCode },
      };
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
      diagnosis: "error",
    };
  }
}

// ─── Package Types ────────────────────────────────────────────────────────────

/**
 * GET /reseller/{reseller}/packageTypes
 * List all available package types (hosting plans) for this reseller.
 */
export async function getPackageTypes(client: TwentyIClient): Promise<TwentyIPackageType[]> {
  const data = await client.get<Record<string, TwentyIPackageType> | TwentyIPackageType[]>(
    "/reseller/{reseller}/packageTypes",
  );
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([id, pkg]) => ({ ...pkg, id }));
}

/**
 * GET /reseller/{reseller}/packageCount
 * Returns the total number of packages (websites) on this reseller account.
 */
export async function getPackageCount(client: TwentyIClient): Promise<number> {
  const data = await client.get<Record<string, unknown>>("/reseller/*/packageCount");
  return Number(data?.count ?? data?.result ?? 0);
}

// ─── Sites / Packages ─────────────────────────────────────────────────────────

/**
 * GET /reseller/{reseller}/web
 * List all websites/packages on this reseller account.
 */
export async function listSites(client: TwentyIClient): Promise<TwentyISite[]> {
  const data = await client.get<TwentyISite[] | Record<string, TwentyISite>>("/reseller/*/web");
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([id, s]) => ({ ...s, id }));
}

/**
 * POST /reseller/{reseller}/addWeb
 * Create a new hosting package (website) under this reseller account.
 */
export async function addWeb(
  client: TwentyIClient,
  opts: TwentyICreateWebOptions,
): Promise<TwentyICreateWebResult> {
  const payload: Record<string, unknown> = {
    domain_name: opts.domain_name,
  };
  if (opts.type) payload.type = opts.type;
  if (opts.extra_domain_names?.length) payload.extra_domain_names = opts.extra_domain_names;
  if (opts.documentRoots) payload.documentRoots = opts.documentRoots;

  const result = await client.post<TwentyICreateWebResult | number | Record<string, unknown>>(
    "/reseller/{reseller}/addWeb",
    payload,
  );

  if (typeof result === "number") return { new_id: String(result) };
  if (typeof result === "object" && result !== null) {
    const r = result as Record<string, unknown>;
    return {
      new_id: String(r.new_id ?? r.id ?? ""),
      domain: String(r.domain ?? opts.domain_name),
    };
  }
  return { new_id: String(result) };
}

/**
 * GET /reseller/{reseller}/web/{id}
 * Get details of a specific hosting package.
 */
export async function getSite(client: TwentyIClient, siteId: string): Promise<TwentyISite> {
  return client.get<TwentyISite>(`/reseller/*/web/${siteId}`);
}

// ─── Managed VPS ─────────────────────────────────────────────────────────────

/**
 * GET /managed_vps/{id}/web
 * List websites on a managed VPS.
 */
export async function listManagedVpsSites(client: TwentyIClient, vpsId: string | number): Promise<TwentyISite[]> {
  const data = await client.get<TwentyISite[]>(`/managed_vps/${vpsId}/web`);
  return Array.isArray(data) ? data : [];
}

/**
 * POST /managed_vps/{id}/addWeb
 * Add a new site on a managed VPS.
 */
export async function addManagedVpsWeb(
  client: TwentyIClient,
  vpsId: string | number,
  opts: { domain_name: string; extra_domain_names?: string[] },
): Promise<TwentyICreateWebResult> {
  const result = await client.post<number | TwentyICreateWebResult>(
    `/managed_vps/${vpsId}/addWeb`,
    opts,
  );
  if (typeof result === "number") return { new_id: String(result) };
  return result as TwentyICreateWebResult;
}

// ─── Reseller Info ────────────────────────────────────────────────────────────

/**
 * GET /reseller/*
 * Get reseller account information.
 */
export async function getResellerInfo(client: TwentyIClient): Promise<TwentyIResellerInfo> {
  return client.get<TwentyIResellerInfo>("/reseller/*");
}

/**
 * GET /reseller/{reseller}/limits
 * Get reseller account limits.
 */
export async function getResellerLimits(client: TwentyIClient): Promise<Record<string, unknown>> {
  return client.get<Record<string, unknown>>("/reseller/*/limits");
}
