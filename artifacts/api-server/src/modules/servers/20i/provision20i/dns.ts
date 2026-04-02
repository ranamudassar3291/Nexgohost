/**
 * 20i DNS Management
 * Manage DNS records for hosting packages.
 *
 * Endpoints:
 *   GET  /package/{id}/web/{webId}/dns      — list records
 *   POST /package/{id}/web/{webId}/dns      — add/update/delete records
 */

import { TwentyIClient } from "./client.js";
import type { TwentyIDnsRecord, TwentyIDnsUpdateOptions } from "./types.js";

// ─── Get DNS Records ──────────────────────────────────────────────────────────

/**
 * GET /package/{packageId}/web/{webId}/dns
 * Returns all DNS records for the site's domain.
 */
export async function getDnsRecords(
  client: TwentyIClient,
  packageId: string,
  webId?: string,
): Promise<TwentyIDnsRecord[]> {
  const wid = webId ?? packageId;
  const data = await client.get<TwentyIDnsRecord[] | Record<string, TwentyIDnsRecord>>(
    `/package/${packageId}/web/${wid}/dns`,
  );
  if (Array.isArray(data)) return data;
  return Object.values(data);
}

// ─── Update DNS Records ───────────────────────────────────────────────────────

/**
 * POST /package/{packageId}/web/{webId}/dns
 * Add, update, or delete DNS records.
 *
 * The body accepts:
 *   add:    TwentyIDnsRecord[]     — records to add
 *   update: TwentyIDnsRecord[]     — records to update (must have id)
 *   delete: Array<{id: string}>    — records to delete
 */
export async function updateDnsRecords(
  client: TwentyIClient,
  packageId: string,
  updates: TwentyIDnsUpdateOptions,
  webId?: string,
): Promise<boolean> {
  const wid = webId ?? packageId;
  await client.post(`/package/${packageId}/web/${wid}/dns`, updates);
  return true;
}

// ─── Convenience Wrappers ─────────────────────────────────────────────────────

/**
 * Add a single DNS record to a site.
 */
export async function addDnsRecord(
  client: TwentyIClient,
  packageId: string,
  record: TwentyIDnsRecord,
  webId?: string,
): Promise<boolean> {
  return updateDnsRecords(client, packageId, { add: [record] }, webId);
}

/**
 * Delete a DNS record by its ID.
 */
export async function deleteDnsRecord(
  client: TwentyIClient,
  packageId: string,
  recordId: string,
  webId?: string,
): Promise<boolean> {
  return updateDnsRecords(client, packageId, { delete: [{ id: recordId }] }, webId);
}

/**
 * Add or replace an A record for a hostname.
 * If an existing A record with the same host exists, it is deleted first.
 */
export async function setARecord(
  client: TwentyIClient,
  packageId: string,
  host: string,
  ip: string,
  ttl = 3600,
  webId?: string,
): Promise<void> {
  const existing = await getDnsRecords(client, packageId, webId);
  const toDelete = existing
    .filter(r => r.type === "A" && r.host === host && r.id)
    .map(r => ({ id: r.id! }));

  const updates: TwentyIDnsUpdateOptions = {
    add: [{ type: "A", host, content: ip, ttl }],
  };
  if (toDelete.length) updates.delete = toDelete;

  await updateDnsRecords(client, packageId, updates, webId);
}

/**
 * Add a CNAME record.
 */
export async function addCname(
  client: TwentyIClient,
  packageId: string,
  host: string,
  target: string,
  ttl = 3600,
  webId?: string,
): Promise<void> {
  await addDnsRecord(client, packageId, { type: "CNAME", host, content: target, ttl }, webId);
}

/**
 * Add an MX record.
 */
export async function addMxRecord(
  client: TwentyIClient,
  packageId: string,
  host: string,
  mailServer: string,
  priority = 10,
  ttl = 3600,
  webId?: string,
): Promise<void> {
  await addDnsRecord(
    client,
    packageId,
    { type: "MX", host, content: mailServer, prio: priority, ttl },
    webId,
  );
}

/**
 * Add a TXT record (e.g. for SPF, DKIM, domain verification).
 */
export async function addTxtRecord(
  client: TwentyIClient,
  packageId: string,
  host: string,
  value: string,
  ttl = 3600,
  webId?: string,
): Promise<void> {
  await addDnsRecord(client, packageId, { type: "TXT", host, content: value, ttl }, webId);
}
