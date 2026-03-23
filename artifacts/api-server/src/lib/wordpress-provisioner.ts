import { exec } from "child_process";
import { promisify } from "util";
import { db } from "@workspace/db";
import { hostingServicesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const execAsync = promisify(exec);

const WP_SIMULATE = process.env.WP_SIMULATE === "true";

// Fallback cPanel account username used when the service record has no username set.
// Override via CPANEL_USER env var for multi-server setups; defaults to "wscreati".
const CPANEL_USER = process.env.CPANEL_USER || "wscreati";

export const WP_STEPS = [
  { key: "database",  label: "Creating database" },
  { key: "download",  label: "Downloading WordPress" },
  { key: "extract",   label: "Extracting files" },
  { key: "configure", label: "Configuring WordPress" },
  { key: "install",   label: "Running installer" },
  { key: "verify",    label: "Verifying installation" },
];

// ── Step tracker ──────────────────────────────────────────────────────────────

async function setStep(serviceId: string, step: string, extra: Record<string, unknown> = {}) {
  console.log(`[WP] [${serviceId}] Step: ${step}`);
  await db.update(hostingServicesTable).set({
    wpProvisionStep: step,
    wpProvisionStatus: "provisioning",
    updatedAt: new Date(),
    ...extra,
  }).where(eq(hostingServicesTable.id, serviceId));
}

// ── cPanel UAPI helper ────────────────────────────────────────────────────────

interface CpanelCtx {
  baseUrl: string;
  username: string;
  password: string;
}

// Sends a cPanel UAPI request via POST with JSON body.
// cPanel UAPI URL: https://{hostname}:2083/execute/{Module}/{function}
// Auth: cPanel API token format — "cpanel username:API_TOKEN"
//   ✅ Correct: Authorization: cpanel wscreati:XXXXTOKEN
//   ❌ Wrong:   Authorization: Basic base64(user:pass)
// The user is identified by the auth header — do NOT put "user" in the request body.
// Body: JSON object with the API params (no "user" field)
// Response: { status: 1 = success, 0 = error, errors: string[], data: any }
async function cpanelUAPI(
  ctx: CpanelCtx,
  module: string,
  fn: string,
  params: Record<string, string> = {},
): Promise<any> {
  const url = `${ctx.baseUrl}execute/${module}/${fn}`;

  console.log(`[cPanel UAPI] POST ${url}`);
  console.log(`[cPanel UAPI] Sending payload:`, JSON.stringify(params));

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `cpanel ${ctx.username}:${ctx.password}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    throw new Error(`cPanel API HTTP error: ${resp.status} ${resp.statusText} — URL: ${url}`);
  }

  const json: any = await resp.json();
  console.log(`[cPanel UAPI] Response for ${module}/${fn}:`, JSON.stringify(json));

  // cPanel UAPI: status=1 means success, anything else is an error
  if (json.status !== 1) {
    const errMsg = (json.errors && json.errors[0]) || json.error || `cPanel ${module}/${fn} returned status ${json.status}`;
    throw new Error(errMsg);
  }

  return json.data;
}

// ── Softaculous installer ─────────────────────────────────────────────────────
// Uses the Softaculous API endpoint built into cPanel.
// Auth: Basic base64(username:password)  — NOT cpanel-token format
// URL:  https://{hostname}:2083/frontend/paper_lantern/softaculous/index.live.php?api=serialize
// Body: application/x-www-form-urlencoded  (querystring)
// Response: serialized text — success is indicated by the word "done" in the body

// Softaculous theme paths to try, in order of preference.
// cPanel servers may use different themes (paper_lantern = legacy, jupiter = modern default).
const SOFTACULOUS_THEMES = ["jupiter", "paper_lantern"];

async function softaculousInstall(
  ctx: CpanelCtx,
  domain: string,
  directory: string,
  adminUser: string,
  adminPass: string,
  adminEmail: string,
  siteName: string,
): Promise<void> {
  const creds = Buffer.from(`${ctx.username}:${ctx.password}`).toString("base64");

  const postData = new URLSearchParams({
    soft:           "26",          // Softaculous script ID for WordPress
    act:            "install",
    protocol:       "https://",
    domain:         domain,
    dir:            directory,     // "" = root, "blog" = /blog subdir
    admin_username: adminUser,     // Softaculous uses admin_username (not admin_user)
    admin_pass:     adminPass,
    admin_email:    adminEmail,
    site_name:      siteName || "My WordPress Site",
    dbprefix:       "wp_",
    language:       "en",
    auto_upgrade:   "1",
  });

  console.log("Softaculous Payload:", postData.toString());

  let lastErr = "";

  for (const theme of SOFTACULOUS_THEMES) {
    const url = `${ctx.baseUrl}frontend/${theme}/softaculous/index.live.php?api=serialize`;
    console.log(`[Softaculous] Trying theme "${theme}" — POST ${url}`);

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization:  `Basic ${creds}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: postData.toString(),
      });

      const text = await resp.text();
      console.log("Softaculous Response:", text.substring(0, 1000));

      if (!resp.ok) {
        lastErr = `HTTP ${resp.status} ${resp.statusText}: ${text.substring(0, 200)}`;
        console.warn(`[Softaculous] theme "${theme}" returned ${resp.status} — trying next theme`);
        continue;
      }

      if (!text.includes("done")) {
        lastErr = `Unexpected response (no "done"): ${text.substring(0, 400)}`;
        console.warn(`[Softaculous] theme "${theme}" did not return "done" — trying next theme`);
        continue;
      }

      // Success
      console.log(`[Softaculous] WordPress installed successfully on ${domain} (theme: ${theme})`);
      return;
    } catch (fetchErr: any) {
      // Network-level failure (connection refused, SSL error, DNS, etc.)
      const cause = fetchErr.cause?.message || fetchErr.cause?.code || fetchErr.message;
      lastErr = `Network error for theme "${theme}": ${cause}`;
      console.warn(`[Softaculous] fetch failed for theme "${theme}": ${lastErr}`);
    }
  }

  // All themes exhausted
  throw new Error(`Softaculous unavailable after trying all themes (${SOFTACULOUS_THEMES.join(", ")}). Last error: ${lastErr}`);
}

// ── Check if WordPress is already installed ────────────────────────────────────

export async function checkWordPressInstalled(
  ctx: CpanelCtx,
  installPath: string = "/",
): Promise<boolean> {
  try {
    const dir = installPath === "/" ? "/public_html" : `/public_html/${installPath.replace(/^\//, "")}`;
    const data = await cpanelUAPI(ctx, "Fileman", "stat", { dir, files: "wp-config.php" });
    const entries: any[] = data?.entries || [];
    return entries.some((e: any) => e.file === "wp-config.php" && e.type === "file");
  } catch {
    return false;
  }
}

// ── Generate strong credentials ───────────────────────────────────────────────

export function generateWpUsername(domainName: string): string {
  const base = (domainName.split(".")[0] || "admin").replace(/[^a-zA-Z0-9]/g, "").substring(0, 8);
  return `${base}${Math.floor(100 + Math.random() * 900)}`;
}

export function generateWpPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const specials = "!@#$%";
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  const rest = Array.from({ length: 10 }, () => rand(chars + upper + digits)).join("");
  return `${rand(upper)}${rand(digits)}${rand(specials)}${rest}`;
}

// ── Main provisioner ──────────────────────────────────────────────────────────

export async function provisionWordPress(
  serviceId: string,
  domain: string,
  siteTitle: string,
  wpUser: string,
  wpPass: string,
  wpEmail: string,
  installPath: string = "/",
  cpanelCtx?: CpanelCtx,
) {
  try {
    if (!cpanelCtx) {
      // Simulation mode — no real cPanel, uniqueness doesn't matter
      const simDbName = `wp_${Date.now().toString().slice(-6)}`;
      console.log(`[WP] No cPanel context for service ${serviceId} — simulation mode`);
      await simulateProvision(serviceId, domain, siteTitle, wpUser, wpPass, wpEmail, installPath, simDbName);
      return;
    }

    console.log(`[WP] Real cPanel provisioning for service ${serviceId} at ${cpanelCtx.baseUrl}`);
    console.log(`[WP] cPanel will handle database creation automatically`);

    await cpanelProvision(serviceId, domain, siteTitle, wpUser, wpPass, wpEmail, installPath, cpanelCtx);
  } catch (err: any) {
    const msg = err?.message || "Unknown error during WordPress provisioning";
    console.error(`[WP] Provisioning failed for ${serviceId}:`, msg);
    await db.update(hostingServicesTable).set({
      wpProvisionStatus: "failed",
      wpProvisionStep: null,
      wpProvisionError: msg,
      updatedAt: new Date(),
    }).where(eq(hostingServicesTable.id, serviceId));
  }
}

// ── Reinstall ─────────────────────────────────────────────────────────────────

export async function reinstallWordPress(
  serviceId: string,
  domain: string,
  siteTitle: string,
  wpUser: string,
  wpPass: string,
  wpEmail: string,
  installPath: string = "/",
  cpanelCtx?: CpanelCtx,
) {
  console.log(`[WP] Reinstalling WordPress for service ${serviceId}`);

  try {
    if (cpanelCtx) {
      // Fetch existing DB name so we can drop it
      const [existing] = await db.select().from(hostingServicesTable)
        .where(eq(hostingServicesTable.id, serviceId)).limit(1);
      const oldDbName = (existing as any)?.wpDbName;
      const oldDbUser = oldDbName; // dbUser == dbName by convention

      // STEP A: Delete old MySQL database + user
      if (oldDbName) {
        console.log(`[WP] Dropping old database: ${oldDbName}`);
        try { await cpanelUAPI(cpanelCtx, "Mysql", "delete_database", { name: oldDbName }); } catch { /* may not exist */ }
        try { await cpanelUAPI(cpanelCtx, "Mysql", "delete_user", { name: oldDbUser }); } catch { /* may not exist */ }
      }

      // STEP B: Remove old WordPress files
      const dir = installPath === "/" ? "/public_html" : `/public_html/${installPath.replace(/^\//, "")}`;
      const wpFiles = ["wp-admin", "wp-content", "wp-includes", "wp-config.php", "wp-login.php", "index.php", "wp-blog-header.php", "xmlrpc.php", "wp-cron.php", ".htaccess"];
      console.log(`[WP] Removing old WordPress files from ${dir}`);
      for (const f of wpFiles) {
        try {
          await cpanelUAPI(cpanelCtx, "Fileman", "delete_files", { files: `${dir}/${f}`, is_skiptrash: "1" });
        } catch { /* file may not exist */ }
      }
    }

    // Mark as starting fresh
    await db.update(hostingServicesTable).set({
      wpInstalled: false,
      wpProvisionStatus: "queued",
      wpProvisionStep: "Queued",
      wpProvisionError: null,
      wpUrl: null,
      wpDbName: null,
      wpUsername: wpUser,
      wpPassword: wpPass,
      wpEmail: wpEmail,
      wpSiteTitle: siteTitle,
      wpProvisionedAt: null,
      updatedAt: new Date(),
    } as any).where(eq(hostingServicesTable.id, serviceId));

    await provisionWordPress(serviceId, domain, siteTitle, wpUser, wpPass, wpEmail, installPath, cpanelCtx);
  } catch (err: any) {
    const msg = err?.message || "Reinstall failed";
    console.error(`[WP] Reinstall failed for ${serviceId}:`, msg);
    await db.update(hostingServicesTable).set({
      wpProvisionStatus: "failed",
      wpProvisionError: msg,
      updatedAt: new Date(),
    }).where(eq(hostingServicesTable.id, serviceId));
  }
}

// ── cPanel-based real install ─────────────────────────────────────────────────

async function cpanelProvision(
  serviceId: string,
  domain: string,
  siteTitle: string,
  wpUser: string,
  wpPass: string,
  wpEmail: string,
  installPath: string,
  ctx: CpanelCtx,
) {
  const directory = installPath === "/" ? "" : installPath.replace(/^\//, "");
  const wpUrl = installPath === "/" ? `https://${domain}` : `https://${domain}/${directory}`;
  const adminUrl = `${wpUrl}/wp-admin`;

  // ── STRATEGY 1: Softaculous (primary) ────────────────────────────────────
  // Uses the Softaculous API built into cPanel to install WordPress.
  // Softaculous handles everything: DB creation, file download, configuration.
  // Auth: Basic base64(username:password) — standard cPanel credentials.
  await setStep(serviceId, "Installing WordPress");
  let usedSoftaculous = false;

  // Pre-flight: resolve cPanel username (for logging; auth is handled by ctx)
  const resolvedCpanelUser = (ctx.username || "").trim() || CPANEL_USER;

  const missingFields: string[] = [];
  if (!domain)  missingFields.push("domain");
  if (!wpUser)  missingFields.push("admin_username");
  if (!wpPass)  missingFields.push("admin_pass");
  if (!wpEmail) missingFields.push("admin_email");
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields for Softaculous install: ${missingFields.join(", ")}`);
  }

  console.log(`[WP] cPanel user: "${resolvedCpanelUser}", host: ${ctx.baseUrl}`);

  try {
    await softaculousInstall(ctx, domain, directory, wpUser, wpPass, wpEmail, siteTitle);
    usedSoftaculous = true;
  } catch (softErr: any) {
    console.warn(`[WP] Softaculous failed: ${softErr.message} — falling back to manual install`);
  }

  if (usedSoftaculous) {
    // Softaculous handled everything — verify wp-config.php exists before saving success
    await setStep(serviceId, "Verifying installation");
    await new Promise(r => setTimeout(r, 5000)); // allow Softaculous to finish writing files
    const isInstalled = await checkWordPressInstalled(ctx, installPath);
    if (!isInstalled) {
      throw new Error(
        "Softaculous reported success but wp-config.php was not found. " +
        "Check that the domain resolves to this server."
      );
    }
  } else {
    // Softaculous was the only supported install method on this server.
    // Direct cPanel UAPI file/database calls (Fileman/run_command, Mysql/create_database)
    // are restricted on shared hosting and intentionally not attempted.
    throw new Error(
      "WordPress installation requires Softaculous, which could not be reached on this server. " +
      "Ensure Softaculous is installed and the cPanel credentials (username + password) are correct. " +
      "Contact your hosting provider if Softaculous access is restricted."
    );
  }

  console.log(`[WP] Install verified ✓ for service ${serviceId} (${domain})`);

  // Save to DB ONLY after real verification passes — never before
  await db.update(hostingServicesTable).set({
    wpInstalled: true,
    wpProvisionStatus: "active",
    wpProvisionStep: "Completed",
    wpProvisionError: null,
    wpUrl: adminUrl,
    wpUsername: wpUser,
    wpPassword: wpPass,
    wpEmail: wpEmail,
    wpSiteTitle: siteTitle,
    wpDbName: dbName,
    wpInstallPath: installPath,
    wpProvisionedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(hostingServicesTable.id, serviceId));

  console.log(`[WP] WordPress fully provisioned for service ${serviceId} (${domain})`);
}

function generateWpConfig(dbName: string, dbUser: string, dbPass: string, dbHost: string): string {
  const genKey = () => Array.from({ length: 64 }, () =>
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?"[
      Math.floor(Math.random() * 92)
    ]
  ).join("");

  return `<?php
define('DB_NAME', '${dbName}');
define('DB_USER', '${dbUser}');
define('DB_PASSWORD', '${dbPass}');
define('DB_HOST', '${dbHost}');
define('DB_CHARSET', 'utf8');
define('DB_COLLATE', '');

define('AUTH_KEY',         '${genKey()}');
define('SECURE_AUTH_KEY',  '${genKey()}');
define('LOGGED_IN_KEY',    '${genKey()}');
define('NONCE_KEY',        '${genKey()}');
define('AUTH_SALT',        '${genKey()}');
define('SECURE_AUTH_SALT', '${genKey()}');
define('LOGGED_IN_SALT',   '${genKey()}');
define('NONCE_SALT',       '${genKey()}');

$table_prefix = 'wp_';
define('WP_DEBUG', false);
if (!defined('ABSPATH')) define('ABSPATH', __DIR__ . '/');
require_once ABSPATH . 'wp-settings.php';
`;
}

// ── Simulation mode ───────────────────────────────────────────────────────────

async function simulateProvision(
  serviceId: string,
  domain: string,
  siteTitle: string,
  wpUser: string,
  wpPass: string,
  wpEmail: string,
  installPath: string,
  dbName: string,
) {
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  console.log(`[WP:SIM] Starting simulated install for ${domain}`);

  for (const step of WP_STEPS) {
    await setStep(serviceId, step.label);
    console.log(`[WP INSTALL STEP: ${step.key}]`);
    await delay(2500);
  }
  // Simulate post-install verification delay
  await delay(1000);

  const pathSuffix = installPath === "/" ? "" : `/${installPath.replace(/^\//, "")}`;
  const wpUrl = `https://${domain}${pathSuffix}`;
  const adminUrl = `${wpUrl}/wp-admin`;
  const safeId = serviceId.replace(/-/g, "").substring(0, 12);

  await db.update(hostingServicesTable).set({
    wpInstalled: true,
    wpProvisionStatus: "active",
    wpProvisionStep: "Completed",
    wpProvisionError: null,
    wpUrl: adminUrl,
    wpUsername: wpUser,
    wpPassword: wpPass,
    wpEmail: wpEmail,
    wpSiteTitle: siteTitle,
    wpDbName: dbName,
    wpContainerId: `sim_wp_${safeId}`,
    wpInstallPath: installPath,
    wpProvisionedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(hostingServicesTable.id, serviceId));

  console.log(`[WP:SIM] WordPress provisioning complete for ${serviceId}`);
}
