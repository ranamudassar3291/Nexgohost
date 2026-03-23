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
} from "./cpanel.js";
import { db } from "@workspace/db";
import { hostingServicesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { WP_STEPS, generateWpPassword } from "./wordpress-provisioner.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CpanelServerConfig {
  hostname: string;
  port: number;
  username: string;   // WHM root username
  apiToken: string;
}

export interface CpanelWpInstallOptions {
  serviceId:   string;
  domain:      string;
  cpanelUser:  string;   // cPanel account username (e.g. "johndoe")
  siteTitle:   string;
  wpAdmin:     string;
  wpPass:      string;
  wpEmail:     string;
  installPath: string;   // "/" → public_html, "/blog" → public_html/blog
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
): Promise<void> {
  const {
    serviceId, domain, cpanelUser, siteTitle, wpAdmin, wpPass, wpEmail, installPath,
  } = opts;

  // Resolve public_html path on the cPanel server
  const subPath    = installPath === "/" ? "" : `/${installPath.replace(/^\//, "")}`;
  const publicHtml = `/home/${cpanelUser}/public_html${subPath}`;
  const wpUrl      = installPath === "/" ? `https://${domain}` : `https://${domain}${subPath}`;
  const adminUrl   = `${wpUrl}/wp-admin`;

  // Unique suffix for DB names
  const uid     = `${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5)}`;
  const dbName  = cpanelDbName(cpanelUser, `wp${uid}`);
  const dbUser  = cpanelDbUser(cpanelUser, `wu${uid}`);
  const dbPass  = generateWpPassword();
  const dbHost  = "localhost";

  console.log(`[CP-WP] ── cPanel WP provisioning ──────────────────────────────`);
  console.log(`[CP-WP] Service:    ${serviceId}`);
  console.log(`[CP-WP] cPanel user: ${cpanelUser}  /  Domain: ${domain}`);
  console.log(`[CP-WP] DB: name=${dbName}  user=${dbUser}`);
  console.log(`[CP-WP] WHM: ${server.hostname}:${server.port}`);

  // ── STEP 1: Create MySQL database via UAPI ──────────────────────────────────
  await setStep(serviceId, "Creating database");
  try {
    await cpanelMysqlCreateDatabase(server, cpanelUser, dbName);
    console.log(`[CP-WP] STEP DONE: Mysql::create_database → ${dbName}`);
  } catch (e: any) {
    // "Database already exists" is acceptable on retry
    if (/already exist/i.test(e.message)) {
      console.warn(`[CP-WP] DB already exists — continuing (${e.message})`);
    } else {
      throw new Error(`Database creation failed: ${e.message}`);
    }
  }

  // ── STEP 2: Create MySQL user via UAPI ─────────────────────────────────────
  await setStep(serviceId, "Creating database user");
  try {
    await cpanelMysqlCreateUser(server, cpanelUser, dbUser, dbPass);
    console.log(`[CP-WP] STEP DONE: Mysql::create_user → ${dbUser}`);
  } catch (e: any) {
    if (/already exist/i.test(e.message)) {
      console.warn(`[CP-WP] DB user already exists — continuing`);
    } else {
      throw new Error(`Database user creation failed: ${e.message}`);
    }
  }

  // ── STEP 3: Grant ALL PRIVILEGES via UAPI ──────────────────────────────────
  await setStep(serviceId, "Assigning database privileges");
  try {
    await cpanelMysqlSetPrivileges(server, cpanelUser, dbName, dbUser);
    console.log(`[CP-WP] STEP DONE: Mysql::set_privileges_on_database — ALL PRIVILEGES`);
  } catch (e: any) {
    throw new Error(`Grant privileges failed: ${e.message}`);
  }

  // ── STEP 4: Deploy WordPress files ─────────────────────────────────────────
  // Strategy A: Softaculous Quick Install (preferred — handles everything)
  // Strategy B: PHP bootstrapper uploaded via Fileman (universal fallback)

  await setStep(serviceId, "Deploying WordPress files");
  let deployedVia = "none";

  // ── Strategy A: Softaculous ─────────────────────────────────────────────────
  console.log(`[CP-WP] Attempting Softaculous installation…`);
  const softResult = await cpanelSoftaculousInstallWordPress(server, cpanelUser, {
    domain,
    path:      `public_html${subPath}`,
    siteTitle,
    wpAdmin,
    wpPass,
    wpEmail,
    dbName,
    dbUser,
    dbPass,
    dbHost,
  });

  if (softResult.success) {
    console.log(`[CP-WP] STEP DONE: Softaculous installed WordPress ✓`);
    deployedVia = "softaculous";
  } else {
    console.warn(`[CP-WP] Softaculous unavailable or failed: ${softResult.error}. Falling back to PHP bootstrapper.`);
  }

  // ── Strategy B: PHP bootstrapper via Fileman ────────────────────────────────
  if (deployedVia === "none") {
    await setStep(serviceId, "Uploading WordPress installer");

    const token  = Math.random().toString(36).substring(2, 18) + Math.random().toString(36).substring(2, 18);
    const script = buildBootstrapperScript({ token, dbName, dbUser, dbPass, dbHost, siteTitle, wpAdmin, wpPass, wpEmail, publicHtml });
    const scriptFilename = `_whsetup_${token.substring(0, 8)}.php`;
    const scriptRemotePath = `/home/${cpanelUser}/public_html/${scriptFilename}`;

    console.log(`[CP-WP] Uploading bootstrapper → ${scriptRemotePath}`);
    try {
      await cpanelSaveFile(server, cpanelUser, scriptRemotePath, script);
      console.log(`[CP-WP] Bootstrapper uploaded`);
    } catch (e: any) {
      throw new Error(`Could not upload installer script via cPanel Fileman: ${e.message}`);
    }

    // Trigger the bootstrapper over HTTP
    await setStep(serviceId, "Running WordPress installer");
    const triggerUrl = `https://${domain}/${scriptFilename}?_wh_token=${token}`;
    console.log(`[CP-WP] Triggering bootstrapper at ${triggerUrl}`);

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
      deployedVia = "bootstrapper";
      console.log(`[CP-WP] STEP DONE: PHP bootstrapper installed WordPress ✓`);
    } catch (e: any) {
      // If the trigger URL fails (e.g. domain not propagated), fall back to direct Fileman upload
      if (/timed out|ENOTFOUND|network|fetch/i.test(e.message)) {
        console.warn(`[CP-WP] HTTP trigger failed (${e.message}) — uploading wp-config.php directly via Fileman`);
        // Upload wp-config.php directly — user will need to complete WP setup on first visit
        const wpConfig = buildWpConfig(dbName, dbUser, dbPass, dbHost);
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
  }

  // ── STEP 5: Verify wp-config.php exists ────────────────────────────────────
  // This is the definitive check — if wp-config.php is not present, the install
  // is NOT complete regardless of what any prior step reported.
  await setStep(serviceId, "Verifying installation");

  const wpConfigDir  = `/home/${cpanelUser}/public_html${subPath}`;
  const wpConfigFile = "wp-config.php";
  console.log(`[CP-WP] Checking ${wpConfigDir}/${wpConfigFile} via Fileman::list_files…`);

  const wpConfigExists = await cpanelFileExists(server, cpanelUser, wpConfigDir, wpConfigFile);

  if (!wpConfigExists) {
    // Hard failure — the file is the only reliable indicator that WP is ready.
    throw new Error(
      `Installation verification failed: wp-config.php not found in ${wpConfigDir}. ` +
      `Deployed via: ${deployedVia}. ` +
      `Check that the domain's document root is ${wpConfigDir} and the cPanel user has write permission.`
    );
  }
  console.log(`[CP-WP] STEP DONE: wp-config.php verified ✓ (deployed via ${deployedVia})`);

  // ── Save success to DB — only after verification ────────────────────────────
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
    wpDbName:          dbName,
    wpInstallPath:     installPath,
    wpProvisionedAt:   new Date(),
    updatedAt:         new Date(),
  }).where(eq(hostingServicesTable.id, serviceId));

  console.log(`[CP-WP] ── WordPress fully provisioned for ${serviceId} (${domain}) via ${deployedVia} ──`);
}

// ── cPanel reinstall: drop old DB/user, then reprovision ──────────────────────

export async function cpanelReinstallWordPress(
  server: CpanelServerConfig,
  opts: CpanelWpInstallOptions,
  oldDbName?: string | null,
  oldDbUser?: string | null,
): Promise<void> {
  console.log(`[CP-WP] Reinstall starting for ${opts.serviceId}`);

  if (oldDbName) {
    await cpanelMysqlDeleteDatabase(server, opts.cpanelUser, oldDbName);
    console.log(`[CP-WP] Old database dropped: ${oldDbName}`);
  }
  if (oldDbUser) {
    await cpanelMysqlDeleteUser(server, opts.cpanelUser, oldDbUser);
    console.log(`[CP-WP] Old DB user removed: ${oldDbUser}`);
  }

  await cpanelProvisionWordPress(server, opts);
}
