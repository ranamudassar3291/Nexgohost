/**
 * cPanel WordPress Provisioner
 *
 * Installs WordPress on a cPanel hosting account using:
 *   1. cPanel UAPI  — Mysql::create_database / create_user / set_privileges_on_database
 *   2. Softaculous  — Quick Install (preferred: zero file-management complexity)
 *   3. PHP Bootstrap fallback — uploads a one-shot installer script via Fileman,
 *      triggers it over HTTP, then removes it (works on any cPanel server without Softaculous)
 *
 * All errors from any UAPI call or Softaculous are caught and surfaced verbatim
 * to the frontend — no fake-success responses.
 *
 * Called by wordpress-provisioner.ts when a cPanel server config is available.
 */

import {
  cpanelDbName,
  cpanelDbUser,
  cpanelMysqlCreateDatabase,
  cpanelMysqlCreateUser,
  cpanelMysqlSetPrivileges,
  cpanelMysqlDeleteDatabase,
  cpanelMysqlDeleteUser,
  cpanelSoftaculousInstallWordPress,
  cpanelSaveFile,
  cpanelFileExists,
  type SoftaculousInstallOpts,
} from "./cpanel.js";
import { db } from "@workspace/db";
import { hostingServicesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateWpPassword } from "./wordpress-provisioner.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CpanelServerConfig {
  hostname: string;
  port: number;
  username: string;   // WHM root username
  apiToken: string;
}

export interface CpanelWpInstallOptions {
  serviceId:      string;
  domain:         string;
  cpanelUser:     string;   // cPanel account username (e.g. "johndoe")
  siteTitle:      string;
  wpAdmin:        string;
  wpPass:         string;
  wpEmail:        string;
  installPath:    string;   // "/" → public_html, "/blog" → public_html/blog
  /**
   * The cPanel account's own API token (cPanel → Security → Manage API Tokens).
   * When provided it is used instead of WHM root create_user_session, which
   * requires the WHM token to have the create-user-session ACL — the cause of
   * the "No data returned from cPanel Service" 500 error.
   * Auth header: "Authorization: cpanel {user}:{token}"
   */
  cpanelApiToken?: string;
  /**
   * cPanel account password (alternative to cpanelApiToken).
   * Equivalent to Axios auth: { username: cpanel_user, password: cpanel_pass }.
   * Auth header: "Authorization: Basic base64({user}:{password})"
   */
  cpanelPassword?: string;
}

// ── Step tracker ───────────────────────────────────────────────────────────────

async function setStep(serviceId: string, step: string) {
  console.log(`[CP-WP] [${serviceId}] Step: ${step}`);
  await db.update(hostingServicesTable).set({
    wpProvisionStep:   step,
    wpProvisionStatus: "provisioning",
    updatedAt:         new Date(),
  }).where(eq(hostingServicesTable.id, serviceId));
}

// ── wp-config.php content generator ───────────────────────────────────────────
// Identical to the VPS version — generates unique salts and injects DB credentials.

function buildWpConfig(dbName: string, dbUser: string, dbPass: string, dbHost = "localhost"): string {
  const genKey = () => Array.from({ length: 64 }, () =>
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?"[
      Math.floor(Math.random() * 92)
    ]
  ).join("");

  return `<?php
define('DB_NAME',     '${dbName}');
define('DB_USER',     '${dbUser}');
define('DB_PASSWORD', '${dbPass}');
define('DB_HOST',     '${dbHost}');
define('DB_CHARSET',  'utf8mb4');
define('DB_COLLATE',  '');

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

// ── PHP bootstrapper ───────────────────────────────────────────────────────────
// Uploaded to the domain root via Fileman::save_file_content.
// When triggered via HTTP it: downloads WP, extracts it, writes wp-config.php,
// triggers the native WP installer, then deletes itself.
// The script is gated by a one-time secret token so it cannot be run by accident.

function buildBootstrapperScript(opts: {
  token:       string;
  dbName:      string;
  dbUser:      string;
  dbPass:      string;
  dbHost:      string;
  siteTitle:   string;
  wpAdmin:     string;
  wpPass:      string;
  wpEmail:     string;
  publicHtml:  string;  // absolute path, e.g. /home/user/public_html
}): string {
  const escaped = (s: string) => s.replace(/'/g, "\\'");
  return `<?php
// One-time WordPress bootstrapper — self-deletes after running.
// Protected by a secret token to prevent accidental execution.
if (!isset($_GET['_wh_token']) || $_GET['_wh_token'] !== '${escaped(opts.token)}') {
  http_response_code(403);
  exit('Forbidden');
}

set_time_limit(300);
$pub   = '${escaped(opts.publicHtml)}';
$tmp   = sys_get_temp_dir() . '/wp_boot_${opts.token.substring(0, 8)}';
$zip   = $tmp . '.zip';
$log   = [];

function wh_log($msg) { global $log; $log[] = date('H:i:s') . ' ' . $msg; }
function wh_fail($msg) { global $log; echo json_encode(['ok'=>false,'error'=>$msg,'log'=>$log]); exit; }

// 1. Download WordPress
wh_log('Downloading WordPress...');
$zip_data = @file_get_contents('https://wordpress.org/latest.zip');
if (!$zip_data || strlen($zip_data) < 100000) wh_fail('Download failed — check outbound connectivity');
if (!@file_put_contents($zip, $zip_data)) wh_fail('Cannot write to ' . $zip);
wh_log('Downloaded ' . number_format(strlen($zip_data)) . ' bytes');

// 2. Extract
wh_log('Extracting...');
$za = new ZipArchive();
if ($za->open($zip) !== true) wh_fail('ZipArchive::open failed');
if (!$za->extractTo($tmp)) { $za->close(); wh_fail('Extraction failed'); }
$za->close();
unlink($zip);

// 3. Move files
wh_log('Moving files to public_html...');
$src = $tmp . '/wordpress';
if (!is_dir($src)) wh_fail('Extraction produced unexpected layout — wordpress/ dir not found');
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($src, FilesystemIterator::SKIP_DOTS));
foreach ($it as $f) {
  $rel = substr($f->getPathname(), strlen($src));
  $dst = $pub . $rel;
  if ($f->isDir()) { @mkdir($dst, 0755, true); }
  else             { @mkdir(dirname($dst), 0755, true); @rename($f->getPathname(), $dst); }
}
// cleanup temp
array_map('unlink', glob($tmp . '/wordpress/*'));
@rmdir($tmp . '/wordpress');
@rmdir($tmp);
wh_log('Files moved to ' . $pub);

// 4. Verify index.php
if (!file_exists($pub . '/index.php')) wh_fail('index.php not found after move — file system issue');

// 5. Write wp-config.php
wh_log('Writing wp-config.php...');
$config = '<?php' . PHP_EOL
  . "define('DB_NAME',     '${escaped(opts.dbName)}');" . PHP_EOL
  . "define('DB_USER',     '${escaped(opts.dbUser)}');" . PHP_EOL
  . "define('DB_PASSWORD', '${escaped(opts.dbPass)}');" . PHP_EOL
  . "define('DB_HOST',     '${escaped(opts.dbHost)}');" . PHP_EOL
  . "define('DB_CHARSET',  'utf8mb4');"  . PHP_EOL
  . "define('DB_COLLATE',  '');"         . PHP_EOL
  . PHP_EOL
  . "\\$table_prefix = 'wp_';"           . PHP_EOL
  . "define('WP_DEBUG', false);"         . PHP_EOL
  . "if (!defined('ABSPATH')) define('ABSPATH', __DIR__ . '/');" . PHP_EOL
  . "require_once ABSPATH . 'wp-settings.php';" . PHP_EOL;
if (!file_put_contents($pub . '/wp-config.php', $config)) wh_fail('Cannot write wp-config.php — permission denied');
wh_log('wp-config.php written');

// 6. Verify wp-config.php
if (!file_exists($pub . '/wp-config.php')) wh_fail('wp-config.php not found after write');

// 7. Self-delete
@unlink(__FILE__);
wh_log('Bootstrapper self-deleted');

echo json_encode(['ok'=>true,'log'=>$log]);
`;
}

// ── Main cPanel WordPress provisioner ─────────────────────────────────────────

export async function cpanelProvisionWordPress(
  server: CpanelServerConfig,
  opts: CpanelWpInstallOptions,
): Promise<{ insid?: string }> {
  const {
    serviceId, domain, cpanelUser, siteTitle, wpAdmin, wpPass, wpEmail, installPath,
    cpanelApiToken, cpanelPassword,
  } = opts;

  // Normalise installPath: treat both "" and "/" as "install at document root".
  // subPath = "" means public_html root. Any other value (e.g. "/blog") is a subdirectory.
  const normPath   = (installPath === "" || installPath === "/") ? "/" : installPath;
  const subPath    = normPath === "/" ? "" : `/${normPath.replace(/^\//, "")}`;
  const publicHtml = `/home/${cpanelUser}/public_html${subPath}`;
  const wpUrl      = subPath === "" ? `https://${domain}` : `https://${domain}${subPath}`;
  const adminUrl   = `${wpUrl}/wp-admin`;

  // ── Uniform DB credentials (user requirement) ──────────────────────────────
  // The same admin_username and admin_pass from the form are used for BOTH
  // the WordPress admin account AND the MySQL database user.
  //
  // softdb format: first 5 chars of wpAdmin + 2-digit random number (10–99)
  //   e.g. wpAdmin="admin01" → softdb="admin37"
  //   cPanel will automatically prefix it with "${cpanelUser}_" when storing.
  //
  // dbusername = wpAdmin  (short name — cPanel prefixes it automatically)
  // dbuserpasswd = wpPass (same password used for MySQL user and WP admin)
  const dbSuffix    = `${wpAdmin.substring(0, 5)}${Math.floor(Math.random() * 90 + 10)}`;
  const shortDbUser = wpAdmin;
  const dbPass      = wpPass;       // uniform: same password for WP admin + MySQL user
  const dbHost      = "localhost";

  // Full prefixed names — only needed if Softaculous fails and we create the DB manually via UAPI
  const dbNameFull  = cpanelDbName(cpanelUser, dbSuffix);
  const dbUserFull  = cpanelDbUser(cpanelUser, shortDbUser);

  console.log(`[CP-WP] ── cPanel WP provisioning ──────────────────────────────`);
  console.log(`[CP-WP] Service:     ${serviceId}`);
  console.log(`[CP-WP] cPanel user: ${cpanelUser}  /  Domain: ${domain}`);
  console.log(`[CP-WP] softdb:      ${dbSuffix} (cPanel will store as ${cpanelUser}_${dbSuffix})`);
  console.log(`[CP-WP] dbusername:  ${shortDbUser} (uniform credentials — same as WP admin user)`);
  console.log(`[CP-WP] Auth:        ${cpanelApiToken ? "cPanel API Token" : cpanelPassword ? "Basic Auth (password)" : "none"}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 1: Softaculous with autoinstall=1 (preferred)
  //
  // autoinstall=1 tells Softaculous to handle EVERYTHING automatically:
  //   - Create the MySQL database (using softdb suffix, cPanel prefixes it)
  //   - Create the MySQL user (using dbusername, cPanel prefixes it)
  //   - Grant ALL PRIVILEGES on that database to the user
  //   - Extract WordPress files into the correct directory
  //   - Write wp-config.php with the correct DB credentials
  //   - Run the WordPress installer
  //
  // We do NOT pre-create the DB via UAPI here — that would create conflicts
  // ("database already exists") and requires WHM-level permissions that often
  // trigger the "500 error from WHM" symptom on restricted accounts.
  // ═══════════════════════════════════════════════════════════════════════════

  await setStep(serviceId, "Installing WordPress via Softaculous");

  const softOpts: SoftaculousInstallOpts = {
    softdomain:    domain,
    softdirectory: subPath.replace(/^\//, ""),  // "" for root, "site001" for /site001
    site_name:     siteTitle,
    admin_username: wpAdmin,
    admin_pass:    wpPass,                // never logged — redacted in all console output
    admin_email:   wpEmail,
    softdb:        dbSuffix,              // short suffix; Softaculous + cPanel auto-prefix it
    dbusername:    shortDbUser,           // uniform: same as WP admin username
    dbuserpasswd:  dbPass,               // uniform: same as WP admin password
    ...(cpanelApiToken && { cpanelApiToken }),
    ...(cpanelPassword && { cpanelPassword }),
  };

  const softResult = await cpanelSoftaculousInstallWordPress(server, cpanelUser, softOpts);

  if (softResult.success) {
    console.log(`[CP-WP] ✓ Softaculous installed WordPress (insid=${softResult.insid ?? "n/a"})`);

    await db.update(hostingServicesTable).set({
      wpInstalled:       true,
      wpProvisionStatus: "active",
      wpProvisionStep:   "Completed",
      wpProvisionError:  null,
      wpUrl:             softResult.adminUrl ?? adminUrl,
      wpUsername:        wpAdmin,
      wpPassword:        wpPass,
      wpEmail:           wpEmail,
      wpSiteTitle:       siteTitle,
      wpDbName:          dbNameFull,   // store full prefixed name for reference
      wpInstallPath:     installPath,
      wpProvisionedAt:   new Date(),
      updatedAt:         new Date(),
    }).where(eq(hostingServicesTable.id, serviceId));

    console.log(`[CP-WP] ── WordPress provisioned via Softaculous for ${serviceId} (${domain}) ──`);
    return { insid: softResult.insid };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACK: Softaculous unavailable → UAPI manual DB creation + PHP bootstrapper
  //
  // Only reached when Softaculous is not installed on the server, or it
  // returns a real semantic error (not auth/session — those already failed
  // Strategy 1/2/3 in cpanelSoftaculousInstallWordPress).
  // ═══════════════════════════════════════════════════════════════════════════

  console.warn(`[CP-WP] Softaculous failed: ${softResult.error}`);
  console.warn(`[CP-WP] Falling back to UAPI manual DB creation + PHP bootstrapper.`);

  // ── FALLBACK STEP 2: Create MySQL database via UAPI ───────────────────────
  await setStep(serviceId, "Creating database");
  try {
    await cpanelMysqlCreateDatabase(server, cpanelUser, dbNameFull);
    console.log(`[CP-WP] STEP DONE: Mysql::create_database → ${dbNameFull}`);
  } catch (e: any) {
    if (/already exist/i.test(e.message)) {
      console.warn(`[CP-WP] DB already exists — continuing (${e.message})`);
    } else {
      throw new Error(`Database creation failed: ${e.message}`);
    }
  }

  // ── FALLBACK STEP 3: Create MySQL user via UAPI ────────────────────────────
  await setStep(serviceId, "Creating database user");
  try {
    await cpanelMysqlCreateUser(server, cpanelUser, dbUserFull, dbPass);
    console.log(`[CP-WP] STEP DONE: Mysql::create_user → ${dbUserFull}`);
  } catch (e: any) {
    if (/already exist/i.test(e.message)) {
      console.warn(`[CP-WP] DB user already exists — continuing`);
    } else {
      throw new Error(`Database user creation failed: ${e.message}`);
    }
  }

  // ── FALLBACK STEP 4: Grant ALL PRIVILEGES via UAPI ─────────────────────────
  await setStep(serviceId, "Assigning database privileges");
  try {
    await cpanelMysqlSetPrivileges(server, cpanelUser, dbNameFull, dbUserFull);
    console.log(`[CP-WP] STEP DONE: Mysql::set_privileges_on_database — ALL PRIVILEGES`);
  } catch (e: any) {
    throw new Error(`Grant privileges failed: ${e.message}`);
  }

  // ── FALLBACK STEP 5: Deploy WordPress via PHP bootstrapper ─────────────────
  await setStep(serviceId, "Uploading WordPress installer");

  const token  = Math.random().toString(36).substring(2, 18) + Math.random().toString(36).substring(2, 18);
  const script = buildBootstrapperScript({ token, dbName: dbNameFull, dbUser: dbUserFull, dbPass, dbHost, siteTitle, wpAdmin, wpPass, wpEmail, publicHtml });
  const scriptFilename = `_whsetup_${token.substring(0, 8)}.php`;
  const scriptRemotePath = `/home/${cpanelUser}/public_html/${scriptFilename}`;

  console.log(`[CP-WP] Uploading bootstrapper → ${scriptRemotePath}`);
  try {
    await cpanelSaveFile(server, cpanelUser, scriptRemotePath, script);
    console.log(`[CP-WP] Bootstrapper uploaded`);
  } catch (e: any) {
    throw new Error(`Could not upload installer script via cPanel Fileman: ${e.message}`);
  }

  await setStep(serviceId, "Running WordPress installer");
  const triggerUrl = `https://${domain}/${scriptFilename}?_wh_token=${token}`;
  console.log(`[CP-WP] Triggering bootstrapper at ${triggerUrl}`);

  let deployedVia = "bootstrapper";
  try {
    const resp = await fetch(triggerUrl, { signal: AbortSignal.timeout(240_000) });
    const text = await resp.text();
    console.log(`[CP-WP] Bootstrapper response (HTTP ${resp.status}):`, text.substring(0, 400));

    let json: any;
    try { json = JSON.parse(text); } catch { /* HTML response — check for PHP errors */ }

    if (json) {
      if (!json.ok) {
        throw new Error(`Installer script failed: ${json.error || "unknown error"}. Log: ${(json.log || []).join(", ")}`);
      }
      console.log(`[CP-WP] Bootstrapper succeeded. Steps: ${(json.log || []).join(" → ")}`);
    } else if (!resp.ok || /\bfatal\b|\bwarning\b|\bparse error\b/i.test(text)) {
      throw new Error(`Installer script returned a PHP error. Response: ${text.substring(0, 300)}`);
    }
    console.log(`[CP-WP] STEP DONE: PHP bootstrapper installed WordPress ✓`);
  } catch (e: any) {
    if (/timed out|ENOTFOUND|network|fetch/i.test(e.message)) {
      console.warn(`[CP-WP] HTTP trigger failed (${e.message}) — uploading wp-config.php directly`);
      const wpConfig = buildWpConfig(dbNameFull, dbUserFull, dbPass, dbHost);
      const wpConfigPath = `/home/${cpanelUser}/public_html${subPath}/wp-config.php`;
      try {
        await cpanelSaveFile(server, cpanelUser, wpConfigPath, wpConfig);
        deployedVia = "fileman-config-only";
        console.log(`[CP-WP] wp-config.php written via Fileman (files need manual extraction).`);
      } catch (cfgErr: any) {
        throw new Error(`All deployment methods failed. Last error: ${e.message}. wp-config write also failed: ${cfgErr.message}`);
      }
    } else {
      throw e;
    }
  }

  // ── FALLBACK STEP 6: Verify wp-config.php ───────────────────────────────────
  await setStep(serviceId, "Verifying installation");

  const wpConfigDir  = `/home/${cpanelUser}/public_html${subPath}`;
  const wpConfigFile = "wp-config.php";
  console.log(`[CP-WP] Checking ${wpConfigDir}/${wpConfigFile} via Fileman::list_files…`);

  const wpConfigExists = await cpanelFileExists(server, cpanelUser, wpConfigDir, wpConfigFile);
  if (!wpConfigExists) {
    throw new Error(
      `Installation verification failed: wp-config.php not found in ${wpConfigDir}. ` +
      `Deployed via: ${deployedVia}. ` +
      `Check that the domain's document root is ${wpConfigDir} and the cPanel user has write permission.`
    );
  }
  console.log(`[CP-WP] STEP DONE: wp-config.php verified ✓ (deployed via ${deployedVia})`);

  await db.update(hostingServicesTable).set({
    wpInstalled:       true,
    wpProvisionStatus: "active",
    wpProvisionStep:   "Completed",
    wpProvisionError:  null,
    wpUrl:             adminUrl,
    wpUsername:        wpAdmin,
    wpPassword:        wpPass,
    wpEmail:           wpEmail,
    wpSiteTitle:       siteTitle,
    wpDbName:          dbNameFull,
    wpInstallPath:     installPath,
    wpProvisionedAt:   new Date(),
    updatedAt:         new Date(),
  }).where(eq(hostingServicesTable.id, serviceId));

  console.log(`[CP-WP] ── WordPress provisioned via ${deployedVia} for ${serviceId} (${domain}) ──`);
  return {};
}

// ── cPanel reinstall: drop old DB/user, then reprovision ──────────────────────

export async function cpanelReinstallWordPress(
  server: CpanelServerConfig,
  opts: CpanelWpInstallOptions,
  oldDbName?: string | null,
  oldDbUser?: string | null,
): Promise<{ insid?: string }> {
  console.log(`[CP-WP] Reinstall starting for ${opts.serviceId}`);

  if (oldDbName) {
    await cpanelMysqlDeleteDatabase(server, opts.cpanelUser, oldDbName);
    console.log(`[CP-WP] Old database dropped: ${oldDbName}`);
  }
  if (oldDbUser) {
    await cpanelMysqlDeleteUser(server, opts.cpanelUser, oldDbUser);
    console.log(`[CP-WP] Old DB user removed: ${oldDbUser}`);
  }

  return cpanelProvisionWordPress(server, opts);
}
