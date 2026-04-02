/**
 * 20i SSL Management
 * Install and manage SSL certificates for hosting packages.
 *
 * Endpoints:
 *   GET  /package/{id}/web/{webId}/ssl   — get SSL info
 *   POST /package/{id}/web/{webId}/ssl   — install/enable SSL
 */

import { TwentyIClient } from "./client.js";
import type { TwentyISSLInfo, TwentyISSLInstallOptions } from "./types.js";

// ─── Get SSL Info ─────────────────────────────────────────────────────────────

/**
 * GET /package/{packageId}/web/{webId}/ssl
 * Returns SSL certificate information for the site.
 */
export async function getSslInfo(
  client: TwentyIClient,
  packageId: string,
  webId?: string,
): Promise<TwentyISSLInfo | null> {
  try {
    const wid = webId ?? packageId;
    return await client.get<TwentyISSLInfo>(`/package/${packageId}/web/${wid}/ssl`);
  } catch {
    return null;
  }
}

// ─── Install Free SSL (Let's Encrypt) ─────────────────────────────────────────

/**
 * POST /package/{packageId}/web/{webId}/ssl
 * Enable / install SSL for the site.
 * When called without a custom certificate it triggers the free Let's Encrypt SSL.
 */
export async function installSsl(
  client: TwentyIClient,
  packageId: string,
  domain?: string,
  webId?: string,
  customCert?: TwentyISSLInstallOptions,
): Promise<{ success: boolean; error?: string }> {
  try {
    const wid = webId ?? packageId;
    const body: Record<string, unknown> = {};
    if (domain) body.domain = domain;
    if (customCert?.key) body.key = customCert.key;
    if (customCert?.crt) body.crt = customCert.crt;
    if (customCert?.ca) body.ca = customCert.ca;

    await client.post(`/package/${packageId}/web/${wid}/ssl`, body);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Force HTTPS ──────────────────────────────────────────────────────────────

/**
 * POST /package/{packageId}/web/{webId}/ssl/forceHttps
 * Enable forced HTTPS redirect for the site.
 */
export async function forceHttps(
  client: TwentyIClient,
  packageId: string,
  enabled = true,
  webId?: string,
): Promise<boolean> {
  const wid = webId ?? packageId;
  await client.post(`/package/${packageId}/web/${wid}/ssl/forceHttps`, { enabled });
  return true;
}

// ─── Free SSL Eligibility ─────────────────────────────────────────────────────

/**
 * GET /package/{packageId}/web/{webId}/ssl/letsencrypt
 * Check Let's Encrypt eligibility and current status.
 */
export async function getLetsEncryptStatus(
  client: TwentyIClient,
  packageId: string,
  webId?: string,
): Promise<Record<string, unknown>> {
  const wid = webId ?? packageId;
  return client.get<Record<string, unknown>>(`/package/${packageId}/web/${wid}/ssl/letsencrypt`);
}
