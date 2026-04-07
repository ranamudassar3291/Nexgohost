/**
 * Dynamic App URL Resolution
 *
 * Priority order:
 * 1. APP_URL env var (set this on your own server or Replit Secrets)
 * 2. REPLIT_DEV_DOMAIN (auto-set by Replit in development)
 * 3. REPLIT_DOMAINS (auto-set by Replit in production/deployed environments)
 * 4. Fallback to noehost.com (only when running on the production server)
 *
 * This means no hardcoded URLs — the same codebase works on Replit, staging, or production.
 */
export function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.REPLIT_DOMAINS) {
    const first = process.env.REPLIT_DOMAINS.split(",")[0]?.trim();
    if (first) return `https://${first}`;
  }
  return "https://noehost.com";
}

/**
 * Returns a clean, public-facing hostname for use in customer-visible text
 * (invoices, emails, PDFs).  Deliberately skips REPLIT_DEV_DOMAIN so that
 * development environments never expose *.replit.dev URLs to customers.
 *
 * Priority:
 *  1. APP_URL env var
 *  2. REPLIT_DOMAINS (deployed domain, not dev tunnel)
 *  3. "noehost.com"
 */
export function getPublicHostname(): string {
  if (process.env.APP_URL) {
    try { return new URL(process.env.APP_URL.replace(/\/$/, "")).hostname; } catch { /* fall through */ }
  }
  if (process.env.REPLIT_DOMAINS) {
    const first = process.env.REPLIT_DOMAINS.split(",")[0]?.trim();
    if (first) return first;
  }
  return "noehost.com";
}

export function getClientUrl(): string {
  return `${getAppUrl()}/client`;
}

export function getAdminUrl(): string {
  return `${getAppUrl()}/admin`;
}
