/**
 * 20i Stack User Management
 * Manage StackCP users — the client-facing control panel access accounts.
 *
 * Stack users allow end clients to access their own StackCP dashboard.
 * Each user can be assigned one or more packages (websites).
 *
 * Endpoints:
 *   GET  /reseller/{reseller}/stackUser              — list all stack users
 *   POST /reseller/{reseller}/stackUser              — create new stack user
 *   POST /stack-user/{id}/assignPackage     — assign package to user
 *   POST /stack-user/{id}/removePackage     — remove package from user
 *   DELETE /stack-user/{id}                 — delete a stack user
 *   POST /stack-user/{id}/loginUrl          — get SSO login URL
 */

import { TwentyIClient } from "./client.js";
import type {
  TwentyIStackUser,
  TwentyICreateStackUserOptions,
  TwentyICreateStackUserResult,
} from "./types.js";

// ─── List Stack Users ─────────────────────────────────────────────────────────

/**
 * GET /reseller/{reseller}/stackUser
 * Returns all stack users on this reseller account.
 */
export async function listStackUsers(client: TwentyIClient): Promise<TwentyIStackUser[]> {
  const data = await client.get<TwentyIStackUser[] | Record<string, TwentyIStackUser>>(
    "/reseller/{reseller}/stackUser",
  );
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([id, u]) => ({ ...u, id }));
}

// ─── Create Stack User ────────────────────────────────────────────────────────

/**
 * POST /reseller/{reseller}/stackUser
 * Create a new StackCP user.
 *
 * Returns the new user's ID and optionally a one-time SSO URL.
 */
export async function createStackUser(
  client: TwentyIClient,
  opts: TwentyICreateStackUserOptions,
): Promise<TwentyICreateStackUserResult> {
  const payload: Record<string, unknown> = {};
  if (opts.name) payload.name = opts.name;
  if (opts.email) payload.email = opts.email;
  if (opts.username) payload.username = opts.username;
  if (opts.password) payload.password = opts.password;
  if (opts.notificationEmail !== undefined) payload.notificationEmail = opts.notificationEmail;

  const result = await client.post<Record<string, unknown> | string | number>(
    "/reseller/{reseller}/stackUser",
    payload,
  );

  if (typeof result === "object" && result !== null) {
    const r = result as Record<string, unknown>;
    return {
      id: String(r.id ?? r.new_id ?? ""),
      ssoUrl: typeof r.ssoUrl === "string" ? r.ssoUrl : undefined,
      username: typeof r.username === "string" ? r.username : opts.username,
    };
  }
  return { id: String(result) };
}

// ─── Get or Create Stack User ─────────────────────────────────────────────────

/**
 * Find an existing stack user by email, or create one if not found.
 * Useful for provisioning — ensures one user per client email address.
 */
export async function getOrCreateStackUser(
  client: TwentyIClient,
  email: string,
  opts: Omit<TwentyICreateStackUserOptions, "email"> = {},
): Promise<TwentyICreateStackUserResult> {
  const users = await listStackUsers(client);
  const existing = users.find(
    u => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (existing) return { id: existing.id, username: existing.username };
  return createStackUser(client, { ...opts, email });
}

// ─── Assign Package ───────────────────────────────────────────────────────────

/**
 * POST /stack-user/{userId}/assignPackage
 * Assign a hosting package (site) to a stack user.
 * After this, the user can log into StackCP and manage the assigned site.
 */
export async function assignPackageToUser(
  client: TwentyIClient,
  userId: string,
  packageId: string,
): Promise<boolean> {
  await client.post(`/stack-user/${userId}/assignPackage`, {
    id: packageId,
  });
  return true;
}

// ─── Remove Package ───────────────────────────────────────────────────────────

/**
 * POST /stack-user/{userId}/removePackage
 * Remove a hosting package assignment from a stack user.
 */
export async function removePackageFromUser(
  client: TwentyIClient,
  userId: string,
  packageId: string,
): Promise<boolean> {
  await client.post(`/stack-user/${userId}/removePackage`, {
    id: packageId,
  });
  return true;
}

// ─── Delete Stack User ────────────────────────────────────────────────────────

/**
 * DELETE /stack-user/{userId}
 * Permanently delete a stack user.
 */
export async function deleteStackUser(
  client: TwentyIClient,
  userId: string,
): Promise<boolean> {
  await client.delete(`/stack-user/${userId}`);
  return true;
}

// ─── SSO Login URL ────────────────────────────────────────────────────────────

/**
 * POST /stack-user/{userId}/loginUrl
 * Generate a one-time SSO login URL for this stack user.
 * The URL expires after first use or after a short time.
 */
export async function getStackUserSsoUrl(
  client: TwentyIClient,
  userId: string,
): Promise<string | null> {
  try {
    const result = await client.post<{ url?: string; loginUrl?: string } | string>(
      `/stack-user/${userId}/loginUrl`,
      {},
    );
    if (typeof result === "string") return result;
    const r = result as Record<string, string>;
    return r?.url ?? r?.loginUrl ?? null;
  } catch {
    return null;
  }
}

// ─── Set Stack User Password ──────────────────────────────────────────────────

/**
 * POST /stack-user/{userId}/password
 * Update the password for a stack user.
 */
export async function setStackUserPassword(
  client: TwentyIClient,
  userId: string,
  newPassword: string,
): Promise<boolean> {
  await client.post(`/stack-user/${userId}/password`, { password: newPassword });
  return true;
}

// ─── Full Provision + Assign Flow ─────────────────────────────────────────────

/**
 * Complete stack user setup:
 * 1. Find or create a stack user for the given email
 * 2. Assign the specified package to them
 * 3. Return the user ID and SSO URL
 *
 * This is the typical flow after createHosting() succeeds.
 */
export async function provisionStackUserAccess(
  client: TwentyIClient,
  email: string,
  packageId: string,
  opts: Omit<TwentyICreateStackUserOptions, "email"> = {},
): Promise<{ userId: string; ssoUrl: string | null }> {
  const user = await getOrCreateStackUser(client, email, opts);
  await assignPackageToUser(client, user.id, packageId);
  const ssoUrl = await getStackUserSsoUrl(client, user.id);
  return { userId: user.id, ssoUrl };
}
