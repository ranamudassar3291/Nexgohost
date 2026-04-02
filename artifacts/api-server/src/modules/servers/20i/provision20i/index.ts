/**
 * 20i Provisioning Module — Main Entry Point
 *
 * A complete Node.js client for the 20i Reseller API.
 * Based on: https://api.20i.com (official API Blueprint v1)
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  AUTHENTICATION                                                          │
 * │  Authorization: Bearer base64(apiKey + "\n")                            │
 * │  Proven from official docs example token:                               │
 * │    "ZTRkNGZkMzFhNTJkY2FlMwo=" → decodes to "e4d4fd31a52dcae3\n"       │
 * │  WITHOUT the "\n", 20i returns {"type":"User ID"} 401 every time.      │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Quick start:
 *
 *   import { createClient, testConnection, createHosting } from "./index.js";
 *
 *   const client = createClient("your-20i-api-key");
 *
 *   const conn = await testConnection(client);
 *   console.log(conn.message);
 *
 *   const hosting = await createHosting(client, {
 *     domain: "example.com",
 *     packageTypeId: "12345",
 *   });
 *   console.log(hosting.siteId);
 *
 * Folder structure:
 *   client.ts       — HTTP client, auth, error classes
 *   types.ts        — All TypeScript interfaces
 *   reseller.ts     — Reseller account, package types, site listing
 *   provision.ts    — Create / suspend / unsuspend / terminate hosting
 *   dns.ts          — DNS record management
 *   email.ts        — Email mailboxes and forwarders
 *   ssl.ts          — SSL certificates (Let's Encrypt + custom)
 *   domains.ts      — Domain registration, transfer, renewal
 *   stack-users.ts  — StackCP user management (client portal access)
 */

// ─── Client ───────────────────────────────────────────────────────────────────

export { TwentyIClient, createClient, buildAuthHeader, sanitiseKey, encodeKey, TwentyIApiError, TwentyIAuthError } from "./client.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type {
  TwentyIConfig,
  TwentyIPackageType,
  TwentyISite,
  TwentyIStackUser,
  TwentyICreateStackUserOptions,
  TwentyICreateStackUserResult,
  TwentyIDnsRecord,
  TwentyIDnsUpdateOptions,
  TwentyIEmailConfig,
  TwentyIEmailForwarder,
  TwentyIEmailMailbox,
  TwentyISSLInfo,
  TwentyISSLInstallOptions,
  TwentyIDomain,
  TwentyIRegisterDomainOptions,
  TwentyIBandwidth,
  TwentyIProvisionResult,
  TwentyIConnectionResult,
  TwentyIDiagnosis,
  TwentyICreateWebOptions,
  TwentyICreateWebResult,
  TwentyIResellerInfo,
  TwentyIPackageCount,
  TwentyIManagedVps,
} from "./types.js";

// ─── Reseller ─────────────────────────────────────────────────────────────────

export {
  testConnection,
  getPackageTypes,
  getPackageCount,
  listSites,
  addWeb,
  getSite,
  getResellerInfo,
  getResellerLimits,
  listManagedVpsSites,
  addManagedVpsWeb,
} from "./reseller.js";

// ─── Provisioning ─────────────────────────────────────────────────────────────

export {
  createHosting,
  suspendHosting,
  unsuspendHosting,
  terminateHosting,
  getHostingPackageType,
  changeHostingPackageType,
  getHostingInfo,
  getSiteDomains,
  terminateManagedVpsHosting,
  findPackageTypeByName,
} from "./provision.js";

export type { CreateHostingOptions } from "./provision.js";

// ─── DNS ──────────────────────────────────────────────────────────────────────

export {
  getDnsRecords,
  updateDnsRecords,
  addDnsRecord,
  deleteDnsRecord,
  setARecord,
  addCname,
  addMxRecord,
  addTxtRecord,
} from "./dns.js";

// ─── Email ────────────────────────────────────────────────────────────────────

export {
  getEmailConfig,
  createForwarder,
  deleteForwarder,
  createMailbox,
  updateMailbox,
  deleteMailbox,
  getSpamConfig,
  updateSpamConfig,
} from "./email.js";

// ─── SSL ──────────────────────────────────────────────────────────────────────

export {
  getSslInfo,
  installSsl,
  forceHttps,
  getLetsEncryptStatus,
} from "./ssl.js";

// ─── Domains ──────────────────────────────────────────────────────────────────

export {
  listDomains,
  getDomain,
  registerDomain,
  transferDomain,
  renewDomain,
  searchDomain,
  getSupportedTlds,
  getNameservers,
  updateNameservers,
  getDomainPrivacy,
  setDomainPrivacy,
  getRegistrant,
  updateRegistrant,
  getAuthCode,
} from "./domains.js";

// ─── Stack Users ──────────────────────────────────────────────────────────────

export {
  listStackUsers,
  createStackUser,
  getOrCreateStackUser,
  assignPackageToUser,
  removePackageFromUser,
  deleteStackUser,
  getStackUserSsoUrl,
  setStackUserPassword,
  provisionStackUserAccess,
} from "./stack-users.js";
