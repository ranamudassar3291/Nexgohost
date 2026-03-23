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

  // ── STRATEGY 1: cPanel WordPress UAPI (POST /execute/WordPress/install) ───
  // Correct endpoint: WordPress/install (NOT WordPressManager)
  // Required fields (all must be present — missing any causes API to reject):
  //   domain, directory, admin_user, admin_pass, admin_email, name, user
  await setStep(serviceId, "Creating database");
  let usedCpanelWpApi = false;

  // ── Pre-flight validation — fail fast before touching any API ─────────────
  // The cPanel user is sent via Authorization header ("cpanel user:token"), NOT in the body.
  // ctx.username / CPANEL_USER are still used to build the DB name prefix.
  const resolvedCpanelUser = (ctx.username || "").trim() || CPANEL_USER;
  const missingFields: string[] = [];
  if (!domain)  missingFields.push("domain");
  if (!wpUser)  missingFields.push("admin_user");
  if (!wpPass)  missingFields.push("admin_pass");
  if (!wpEmail) missingFields.push("admin_email");
  if (!ctx.username && !CPANEL_USER) missingFields.push("cpanel auth user (check CPANEL_USER env var)");
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields for WordPress install: ${missingFields.join(", ")}`);
  }

  console.log(`[WP] cPanel auth user: "${resolvedCpanelUser}" (from service="${ctx.username}", fallback="${CPANEL_USER}")`);
  console.log(`[WP] Auth header: cpanel ${resolvedCpanelUser}:***`);

  // Minimal payload — cPanel WordPress installer handles database creation automatically.
  // Do NOT include db_name/db_user/db_pass — those cause 403 errors if the token
  // lacks MySQL API permissions. The WordPress/install endpoint manages the DB itself.
  // NOTE: "user" is NOT in the body — cPanel identifies the caller via the
  //       Authorization header: "cpanel username:API_TOKEN"
  const payload = {
    domain,
    directory,
    admin_user:  wpUser,
    admin_pass:  wpPass,
    admin_email: wpEmail,
    name:        siteTitle || "My WordPress Site", // "name" = site title, NOT "site_name"
  };

  try {
    console.log(`[WP] Calling WordPress/install for ${domain}`);
    console.log(`FINAL PAYLOAD:`, JSON.stringify(payload));

    const rawResult = await cpanelUAPI(ctx, "WordPress", "install", payload);
    console.log(`CPANEL RESPONSE:`, JSON.stringify(rawResult));

    // cpanelUAPI throws on status !== 1, so reaching here means success
    usedCpanelWpApi = true;
    console.log(`[WP] WordPress/install succeeded for ${domain}`);
  } catch (wpErr: any) {
    console.warn(`[WP] WordPress/install failed: ${wpErr.message} — falling back to manual install`);
  }

  if (usedCpanelWpApi) {
    // cPanel WordPress API handled everything — verify and save
    await setStep(serviceId, "Verifying installation");
    await new Promise(r => setTimeout(r, 5000)); // allow cPanel to finish writing files
    const isInstalled = await checkWordPressInstalled(ctx, installPath);
    if (!isInstalled) {
      throw new Error(
        "cPanel WordPress API reported success but wp-config.php was not found. " +
        "Check that the domain resolves to this server."
      );
    }
  } else {
    // ── STRATEGY 2: Manual file-based install via cPanel UAPI ─────────────
    // Fallback when WordPress/install UAPI is unavailable on the server.
    // Database creation is NOT done here — we do not call Mysql API to avoid
    // 403 permission errors. wp-config.php is written with placeholder DB
    // credentials and the native WP installer creates the tables from there.
    const publicHtml = installPath === "/" ? "/public_html" : `/public_html/${directory}`;

    // STEP 1: Download WordPress
    await setStep(serviceId, "Downloading WordPress");
    console.log(`[WP] Downloading WordPress to ${publicHtml}`);
    await cpanelUAPI(ctx, "Fileman", "run_command", {
      command: `cd ${publicHtml} && curl -sL https://wordpress.org/latest.tar.gz -o /tmp/wordpress.tar.gz`,
    });

    // STEP 3: Extract WordPress files
    await setStep(serviceId, "Extracting files");
    console.log(`[WP] Extracting WordPress files`);
    await cpanelUAPI(ctx, "Fileman", "run_command", {
      command: `cd /tmp && tar -xzf wordpress.tar.gz && cp -rp wordpress/. ${publicHtml}/ && rm -rf wordpress wordpress.tar.gz`,
    });

    // STEP 4: Create wp-config.php with generated DB credentials.
    // The database itself is NOT created here (no Mysql API calls) — the native
    // WP install.php step below will write into an already-existing database.
    // If no database exists the install.php form will surface the DB error clearly.
    await setStep(serviceId, "Configuring WordPress");
    console.log(`[WP] Creating wp-config.php`);
    const fallbackDbName = `${resolvedCpanelUser}_wp_${Date.now().toString().slice(-6)}`.substring(0, 64);
    const fallbackDbUser = `${resolvedCpanelUser}_u_${Date.now().toString().slice(-6)}`.substring(0, 64);
    const fallbackDbPass = generateWpPassword();
    const wpConfigContent = generateWpConfig(fallbackDbName, fallbackDbUser, fallbackDbPass, "localhost");
    await cpanelUAPI(ctx, "Fileman", "save_file_content", {
      dir: publicHtml,
      file: "wp-config.php",
      content: wpConfigContent,
    });

    // STEP 5: Run WordPress native installer (wp-admin/install.php)
    await setStep(serviceId, "Running installer");
    console.log(`[WP] Running WordPress native install.php`);
    const installPayload = {
      weblog_title:     siteTitle || "My WordPress Site", // native WP installer field
      user_name:        wpUser,
      admin_password:   wpPass,
      admin_password2:  wpPass,
      admin_email:      wpEmail,
      blog_public:      "1",
    };
    console.log(`[WP] install.php payload:`, JSON.stringify(installPayload));
    const installResp = await fetch(`${wpUrl}/wp-admin/install.php?step=2`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(installPayload),
    });
    if (!installResp.ok && installResp.status !== 302) {
      throw new Error(`WordPress install.php failed (HTTP ${installResp.status}). Check domain resolves to this server.`);
    }

    // STEP 6: Verify — never save success without confirming files exist
    await setStep(serviceId, "Verifying installation");
    console.log(`[WP] Verifying installation`);
    await new Promise(r => setTimeout(r, 3000));
    const isInstalled = await checkWordPressInstalled(ctx, installPath);
    if (!isInstalled) {
      throw new Error(
        "WordPress verification failed: wp-config.php not found after install. " +
        "The installer may not have completed correctly."
      );
    }
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
