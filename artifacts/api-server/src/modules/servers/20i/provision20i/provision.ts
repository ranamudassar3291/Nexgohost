/**
 * 20i Provisioning Operations
 * Create, suspend, unsuspend, terminate, and modify hosting packages.
 * All package-level operations operate on /package/{id}/...
 */

import { TwentyIClient } from "./client.js";
import { addWeb, getPackageTypes } from "./reseller.js";
import type {
  TwentyIProvisionResult,
  TwentyIPackageType,
  TwentyISite,
} from "./types.js";

// ─── Create Hosting ──────────────────────────────────────────────────────────

export interface CreateHostingOptions {
  domain: string;
  packageTypeId: string;
  extraDomains?: string[];
  documentRoots?: Record<string, string>;
}

/**
 * Create a new hosting package (website) for a domain.
 * Calls POST /reseller/{reseller}/addWeb then sets the package type.
 *
 * Returns the new site ID and basic details.
 */
export async function createHosting(
  client: TwentyIClient,
  opts: CreateHostingOptions,
): Promise<TwentyIProvisionResult> {
  try {
    const result = await addWeb(client, {
      domain_name: opts.domain,
      type: opts.packageTypeId,
      extra_domain_names: opts.extraDomains,
      documentRoots: opts.documentRoots,
    });

    const siteId = String(result.new_id ?? result.id ?? "");
    if (!siteId) {
      return { success: false, error: "20i returned no site ID after creation" };
    }

    return {
      success: true,
      siteId,
      domain: opts.domain,
      stackCPUrl: `https://stackcp.com/client/login/?cpanel_jsonapi_module=Login&login-subject=web:${siteId}`,
      message: `Hosting created for ${opts.domain} (site ID: ${siteId})`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Suspend ──────────────────────────────────────────────────────────────────

/**
 * POST /package/{id}/userStatus
 * Suspend a hosting package. Sets the default subservice to false (disabled).
 *
 * Docs: "Possible subservice_name are 'default' for a typical set of services
 * and 'main' for the core service only."
 */
export async function suspendHosting(
  client: TwentyIClient,
  siteId: string,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await client.post(`/package/${siteId}/userStatus`, {
      subservices: { default: false },
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Unsuspend ────────────────────────────────────────────────────────────────

/**
 * POST /package/{id}/userStatus
 * Unsuspend (reactivate) a hosting package.
 */
export async function unsuspendHosting(
  client: TwentyIClient,
  siteId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await client.post(`/package/${siteId}/userStatus`, {
      includeRepeated: true,
      subservices: { default: true },
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Terminate / Delete ───────────────────────────────────────────────────────

/**
 * POST /reseller/{reseller}/deleteWeb
 * Delete hosting packages by site ID. This is irreversible.
 */
export async function terminateHosting(
  client: TwentyIClient,
  siteId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await client.post("/reseller/*/deleteWeb", {
      "delete-id": [siteId],
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Package Type (Plan) ──────────────────────────────────────────────────────

/**
 * GET /package/{id}/type
 * Get the current package type for a site.
 */
export async function getHostingPackageType(
  client: TwentyIClient,
  siteId: string,
): Promise<{ id?: string; name?: string } | null> {
  try {
    return await client.get<{ id?: string; name?: string }>(`/package/${siteId}/type`);
  } catch {
    return null;
  }
}

/**
 * POST /package/{id}/type
 * Change the package type (upgrade/downgrade plan) for a site.
 */
export async function changeHostingPackageType(
  client: TwentyIClient,
  siteId: string,
  newPackageTypeId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await client.post(`/package/${siteId}/type`, { packageType: newPackageTypeId });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Site Info ────────────────────────────────────────────────────────────────

/**
 * GET /package/{id}/web
 * Get full web site information for a package.
 */
export async function getHostingInfo(
  client: TwentyIClient,
  siteId: string,
): Promise<TwentyISite | null> {
  try {
    return await client.get<TwentyISite>(`/package/${siteId}/web`);
  } catch {
    return null;
  }
}

/**
 * GET /package/{id}/web/{webId}/domain
 * List all domain names attached to a specific website within a package.
 */
export async function getSiteDomains(
  client: TwentyIClient,
  siteId: string,
  webId?: string,
): Promise<string[]> {
  try {
    const id = webId ?? siteId;
    const data = await client.get<string[] | Record<string, string>>(`/package/${siteId}/web/${id}/domain`);
    if (Array.isArray(data)) return data;
    return Object.values(data);
  } catch {
    return [];
  }
}

// ─── Reseller Managed VPS ─────────────────────────────────────────────────────

/**
 * POST /managed_vps/{id}/deleteWeb
 * Delete web sites from a managed VPS.
 */
export async function terminateManagedVpsHosting(
  client: TwentyIClient,
  vpsId: string | number,
  siteId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await client.post(`/managed_vps/${vpsId}/deleteWeb`, {
      "delete-id": [siteId],
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Bulk provisioning helper ─────────────────────────────────────────────────

/**
 * Find a package type by name (case-insensitive partial match).
 * Useful for resolving plan names to 20i package type IDs.
 */
export async function findPackageTypeByName(
  client: TwentyIClient,
  name: string,
): Promise<TwentyIPackageType | null> {
  try {
    const types = await getPackageTypes(client);
    const lower = name.toLowerCase();
    return (
      types.find(t => t.id === name) ??
      types.find(t => (t.name ?? "").toLowerCase().includes(lower)) ??
      types.find(t => (t.label ?? "").toLowerCase().includes(lower)) ??
      null
    );
  } catch {
    return null;
  }
}
