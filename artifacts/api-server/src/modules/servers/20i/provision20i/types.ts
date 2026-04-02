/**
 * 20i Reseller API — TypeScript Type Definitions
 * Based on official 20i API Blueprint: https://api.20i.com
 *
 * Authentication: Authorization: Bearer base64(apiKey + "\n")
 * Reseller self-reference: use "*" in place of resellerId
 */

// ─── Auth & Config ────────────────────────────────────────────────────────────

export interface TwentyIConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  proxyUrl?: string;
}

// ─── Error ────────────────────────────────────────────────────────────────────

export interface TwentyIApiError {
  code: number | null;
  message: string;
  data?: Record<string, unknown>;
}

export interface TwentyIErrorResponse {
  error: TwentyIApiError;
  type?: string;
  user?: string;
  permission?: string;
}

// ─── Package Types ────────────────────────────────────────────────────────────

export interface TwentyIPackageType {
  id: string;
  name: string;
  label?: string;
  price?: number;
  limits?: {
    web?: number;
    subdomains?: number;
    email?: number;
    disk?: number;
    bandwidth?: number;
    mysql?: number;
    ftp?: number;
  };
}

// ─── Web / Hosting Sites ──────────────────────────────────────────────────────

export interface TwentyISite {
  id: string;
  domain: string;
  platformHostname?: string;
  stackCPUrl?: string;
  type?: string;
  typeRef?: string;
  names?: string[];
  active?: boolean;
  suspended?: boolean;
}

export interface TwentyICreateWebOptions {
  domain_name: string;
  extra_domain_names?: string[];
  type?: string;
  documentRoots?: Record<string, string>;
}

export interface TwentyICreateWebResult {
  new_id?: string | number;
  id?: string | number;
  domain?: string;
  result?: boolean;
}

// ─── Stack Users ──────────────────────────────────────────────────────────────

export interface TwentyIStackUser {
  id: string;
  username?: string;
  name?: string;
  email?: string;
  packages?: string[];
}

export interface TwentyICreateStackUserOptions {
  username?: string;
  name?: string;
  email?: string;
  password?: string;
  notificationEmail?: boolean;
}

export interface TwentyICreateStackUserResult {
  id: string;
  ssoUrl?: string;
  username?: string;
  password?: string;
}

// ─── DNS ──────────────────────────────────────────────────────────────────────

export interface TwentyIDnsRecord {
  id?: string;
  host?: string;
  type: string;
  content: string;
  ttl?: number;
  prio?: number;
}

export interface TwentyIDnsUpdateOptions {
  add?: TwentyIDnsRecord[];
  delete?: Array<{ id: string }>;
  update?: TwentyIDnsRecord[];
}

// ─── Email ────────────────────────────────────────────────────────────────────

export interface TwentyIEmailForwarder {
  id?: string;
  lhs: string;
  dest: string[];
}

export interface TwentyIEmailMailbox {
  id?: string;
  pop?: string;
  username?: string;
  quota?: number;
}

export interface TwentyIEmailConfig {
  forwarders?: TwentyIEmailForwarder[];
  mailboxes?: TwentyIEmailMailbox[];
}

// ─── SSL ──────────────────────────────────────────────────────────────────────

export interface TwentyISSLInfo {
  domain?: string;
  expiryDate?: string;
  issuer?: string;
  enabled?: boolean;
}

export interface TwentyISSLInstallOptions {
  key?: string;
  crt?: string;
  ca?: string;
}

// ─── Domains ──────────────────────────────────────────────────────────────────

export interface TwentyIDomain {
  id: string;
  name: string;
  expiryDate?: string;
  deadDate?: string;
  hasPrivacy?: boolean;
  pendingTransfer?: boolean;
  registrantIsVerified?: boolean;
  closeToAnniversary?: boolean;
  preferredRenewalMonths?: number;
}

export interface TwentyIRegisterDomainOptions {
  domain: string;
  period?: number;
  privacy?: boolean;
  registrant?: {
    name: string;
    organisation?: string;
    address1: string;
    city: string;
    state?: string;
    postcode: string;
    country: string;
    phone: string;
    email: string;
  };
  nameservers?: string[];
}

// ─── Bandwidth ────────────────────────────────────────────────────────────────

export interface TwentyIBandwidth {
  used?: number;
  limit?: number;
  unit?: string;
}

// ─── Reseller ─────────────────────────────────────────────────────────────────

export interface TwentyIResellerInfo {
  id?: string;
  name?: string;
  email?: string;
}

export interface TwentyIPackageCount {
  count: number;
}

// ─── Provisioning Result ──────────────────────────────────────────────────────

export interface TwentyIProvisionResult {
  success: boolean;
  siteId?: string;
  domain?: string;
  stackCPUrl?: string;
  ssoUrl?: string;
  userId?: string;
  message?: string;
  error?: string;
}

// ─── Connection Test ──────────────────────────────────────────────────────────

export type TwentyIDiagnosis =
  | "connected"
  | "wrong_key"
  | "ip_blocked"
  | "unknown_401"
  | "error";

export interface TwentyIConnectionResult {
  success: boolean;
  message: string;
  packageCount?: number;
  diagnosis?: TwentyIDiagnosis;
  diagnostic?: {
    detail?: string;
    endpoint?: string;
    status?: number;
    body?: string;
  };
}

// ─── Managed VPS ─────────────────────────────────────────────────────────────

export interface TwentyIManagedVps {
  id: string | number;
  name?: string;
  hostname?: string;
  status?: string;
}
