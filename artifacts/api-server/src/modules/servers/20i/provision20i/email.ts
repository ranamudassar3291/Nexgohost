/**
 * 20i Email Management
 * Manage email mailboxes and forwarders for hosting packages.
 *
 * Endpoints:
 *   GET  /package/{id}/web/{webId}/email           — get email config
 *   POST /package/{id}/web/{webId}/email/forwarder  — add forwarder
 *   POST /package/{id}/web/{webId}/email/mailbox    — add mailbox
 */

import { TwentyIClient } from "./client.js";
import type { TwentyIEmailConfig, TwentyIEmailForwarder, TwentyIEmailMailbox } from "./types.js";

// ─── Get Email Config ─────────────────────────────────────────────────────────

/**
 * GET /package/{packageId}/web/{webId}/email
 * Returns full email configuration including mailboxes and forwarders.
 */
export async function getEmailConfig(
  client: TwentyIClient,
  packageId: string,
  webId?: string,
): Promise<TwentyIEmailConfig> {
  const wid = webId ?? packageId;
  const data = await client.get<TwentyIEmailConfig>(`/package/${packageId}/web/${wid}/email`);
  return {
    forwarders: Array.isArray(data?.forwarders) ? data.forwarders : [],
    mailboxes: Array.isArray(data?.mailboxes) ? data.mailboxes : [],
  };
}

// ─── Forwarders ───────────────────────────────────────────────────────────────

/**
 * POST /package/{packageId}/web/{webId}/email/forwarder
 * Create an email forwarder.
 *
 * @param lhs  Local part (e.g. "info" for info@domain.com)
 * @param dest Array of destination email addresses
 */
export async function createForwarder(
  client: TwentyIClient,
  packageId: string,
  lhs: string,
  dest: string[],
  webId?: string,
): Promise<boolean> {
  const wid = webId ?? packageId;
  await client.post(`/package/${packageId}/web/${wid}/email/forwarder`, { lhs, dest });
  return true;
}

/**
 * DELETE /package/{packageId}/web/{webId}/email/forwarder/{id}
 * Delete an email forwarder by its ID.
 */
export async function deleteForwarder(
  client: TwentyIClient,
  packageId: string,
  forwarderId: string,
  webId?: string,
): Promise<boolean> {
  const wid = webId ?? packageId;
  await client.delete(`/package/${packageId}/web/${wid}/email/forwarder/${forwarderId}`);
  return true;
}

// ─── Mailboxes ────────────────────────────────────────────────────────────────

/**
 * POST /package/{packageId}/web/{webId}/email/mailbox
 * Create a new email mailbox.
 *
 * @param username  Local part (e.g. "john" for john@domain.com)
 * @param password  Mailbox password
 * @param quota     Disk quota in MB (default 1024)
 */
export async function createMailbox(
  client: TwentyIClient,
  packageId: string,
  username: string,
  password: string,
  quota = 1024,
  webId?: string,
): Promise<boolean> {
  const wid = webId ?? packageId;
  await client.post(`/package/${packageId}/web/${wid}/email/mailbox`, {
    pop: username,
    password,
    quota,
  });
  return true;
}

/**
 * POST /package/{packageId}/web/{webId}/email/mailbox/{id}
 * Update mailbox password or quota.
 */
export async function updateMailbox(
  client: TwentyIClient,
  packageId: string,
  mailboxId: string,
  updates: { password?: string; quota?: number },
  webId?: string,
): Promise<boolean> {
  const wid = webId ?? packageId;
  await client.post(`/package/${packageId}/web/${wid}/email/mailbox/${mailboxId}`, updates);
  return true;
}

/**
 * DELETE /package/{packageId}/web/{webId}/email/mailbox/{id}
 * Delete a mailbox.
 */
export async function deleteMailbox(
  client: TwentyIClient,
  packageId: string,
  mailboxId: string,
  webId?: string,
): Promise<boolean> {
  const wid = webId ?? packageId;
  await client.delete(`/package/${packageId}/web/${wid}/email/mailbox/${mailboxId}`);
  return true;
}

// ─── Anti-spam ────────────────────────────────────────────────────────────────

/**
 * GET /package/{packageId}/web/{webId}/email/spam
 * Get spam filter settings.
 */
export async function getSpamConfig(
  client: TwentyIClient,
  packageId: string,
  webId?: string,
): Promise<Record<string, unknown>> {
  const wid = webId ?? packageId;
  return client.get<Record<string, unknown>>(`/package/${packageId}/web/${wid}/email/spam`);
}

/**
 * POST /package/{packageId}/web/{webId}/email/spam
 * Update spam filter settings.
 */
export async function updateSpamConfig(
  client: TwentyIClient,
  packageId: string,
  config: Record<string, unknown>,
  webId?: string,
): Promise<boolean> {
  const wid = webId ?? packageId;
  await client.post(`/package/${packageId}/web/${wid}/email/spam`, config);
  return true;
}
