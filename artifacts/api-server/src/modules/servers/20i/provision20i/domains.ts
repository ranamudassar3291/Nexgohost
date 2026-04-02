// 20i Domain Management
// Register, transfer, renew, and manage domain names.
// API docs: https://api.20i.com

import { TwentyIClient } from "./client.js";
import type { TwentyIDomain, TwentyIRegisterDomainOptions } from "./types.js";

// ─── List Domains ─────────────────────────────────────────────────────────────

// GET /domain
// List all domains registered or managed on this reseller account.
export async function listDomains(client: TwentyIClient): Promise<TwentyIDomain[]> {
  const data = await client.get<TwentyIDomain[] | Record<string, TwentyIDomain>>("/domain");
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([id, d]) => ({ ...d, id }));
}

// ─── Get Domain ───────────────────────────────────────────────────────────────

// GET /domain/{id}
// Get details of a specific domain by its ID or domain name.
export async function getDomain(client: TwentyIClient, domainId: string): Promise<TwentyIDomain | null> {
  try {
    return await client.get<TwentyIDomain>(`/domain/${domainId}`);
  } catch {
    return null;
  }
}

// ─── Register Domain ──────────────────────────────────────────────────────────

// POST /reseller/{reseller}/registerDomain
// Register a new domain name.
export async function registerDomain(
  client: TwentyIClient,
  opts: TwentyIRegisterDomainOptions,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const payload: Record<string, unknown> = {
      domain: opts.domain,
      period: opts.period ?? 1,
      privacy: opts.privacy ?? false,
    };
    if (opts.registrant) payload.registrant = opts.registrant;
    if (opts.nameservers?.length) payload.nameservers = opts.nameservers;

    const result = await client.post<{ id?: string; result?: boolean } | string | boolean>(
      "/reseller/*/registerDomain",
      payload,
    );
    if (typeof result === "object" && result !== null) {
      const r = result as Record<string, unknown>;
      return { success: true, id: String(r.id ?? "") };
    }
    return { success: Boolean(result) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Transfer Domain ──────────────────────────────────────────────────────────

// POST /reseller/{reseller}/transferDomain
// Initiate a domain transfer in.
export async function transferDomain(
  client: TwentyIClient,
  domain: string,
  authCode: string,
  period = 1,
): Promise<{ success: boolean; error?: string }> {
  try {
    await client.post("/reseller/*/transferDomain", { domain, authCode, period });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Renew Domain ─────────────────────────────────────────────────────────────

// POST /domain/{id}/renewDomain
// Renew a domain for the specified number of years.
export async function renewDomain(
  client: TwentyIClient,
  domainId: string,
  years = 1,
): Promise<{ success: boolean; error?: string }> {
  try {
    await client.post(`/domain/${domainId}/renewDomain`, { period: years });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Domain Search ────────────────────────────────────────────────────────────

// GET /domain-search/{prefix_or_name}
// Search domain availability. Supports comma-separated domain names.
export async function searchDomain(
  client: TwentyIClient,
  query: string,
): Promise<Array<{ name: string; can: string; price?: number; expiryDate?: string }>> {
  const data = await client.get<unknown[]>(`/domain-search/${encodeURIComponent(query)}`);
  if (!Array.isArray(data)) return [];
  return data as Array<{ name: string; can: string; price?: number; expiryDate?: string }>;
}

// ─── Supported TLDs ───────────────────────────────────────────────────────────

// GET /domain-period
// List all supported TLDs and their registration periods.
export async function getSupportedTlds(
  client: TwentyIClient,
): Promise<Record<string, number[]>> {
  return client.get<Record<string, number[]>>("/domain-period");
}

// ─── Nameservers ──────────────────────────────────────────────────────────────

// GET /domain/{id}/nameservers
export async function getNameservers(client: TwentyIClient, domainId: string): Promise<string[]> {
  const data = await client.get<string[] | Record<string, string>>(`/domain/${domainId}/nameservers`);
  if (Array.isArray(data)) return data;
  return Object.values(data);
}

// POST /domain/{id}/nameservers
export async function updateNameservers(
  client: TwentyIClient,
  domainId: string,
  nameservers: string[],
): Promise<boolean> {
  await client.post(`/domain/${domainId}/nameservers`, { nameservers });
  return true;
}

// ─── Domain Privacy ───────────────────────────────────────────────────────────

// GET /domain/{id}/privacyService
export async function getDomainPrivacy(
  client: TwentyIClient,
  domainId: string,
): Promise<{ enabled?: boolean }> {
  return client.get<{ enabled?: boolean }>(`/domain/${domainId}/privacyService`);
}

// POST /domain/{id}/privacyService
// Enable or disable WHOIS privacy protection.
export async function setDomainPrivacy(
  client: TwentyIClient,
  domainId: string,
  enabled: boolean,
): Promise<boolean> {
  await client.post(`/domain/${domainId}/privacyService`, { enabled });
  return true;
}

// ─── Registrant / Contact ─────────────────────────────────────────────────────

// GET /domain/{id}/registrant
export async function getRegistrant(
  client: TwentyIClient,
  domainId: string,
): Promise<Record<string, unknown>> {
  return client.get<Record<string, unknown>>(`/domain/${domainId}/registrant`);
}

// POST /domain/{id}/registrant
export async function updateRegistrant(
  client: TwentyIClient,
  domainId: string,
  details: Record<string, unknown>,
): Promise<boolean> {
  await client.post(`/domain/${domainId}/registrant`, details);
  return true;
}

// ─── Auth Code (EPP) ──────────────────────────────────────────────────────────

// GET /domain/{id}/authCode
// Get the EPP/auth code for domain transfer out.
export async function getAuthCode(client: TwentyIClient, domainId: string): Promise<string | null> {
  try {
    const data = await client.get<{ authCode?: string } | string>(`/domain/${domainId}/authCode`);
    if (typeof data === "string") return data;
    return (data as Record<string, string>)?.authCode ?? null;
  } catch {
    return null;
  }
}
