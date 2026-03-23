import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import mysql2 from "mysql2/promise";
import { db } from "@workspace/db";
import { hostingServicesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { cpanelProvisionWordPress, cpanelReinstallWordPress, type CpanelServerConfig } from "./cpanel-wordpress.js";

const execAsync = promisify(exec);

// ── VPS Configuration ─────────────────────────────────────────────────────────
const VPS_BASE_DIR   = process.env.WP_BASE_DIR        || "/var/www";
const MYSQL_HOST     = process.env.WP_MYSQL_HOST       || "localhost";
const MYSQL_PORT     = parseInt(process.env.WP_MYSQL_PORT || "3306", 10);
const MYSQL_ROOT_USER= process.env.WP_MYSQL_ROOT_USER  || "root";
const MYSQL_ROOT_PASS= process.env.WP_MYSQL_ROOT_PASS  || "";
const WWW_USER       = process.env.WP_WWW_USER         || "www-data";

export const WP_STEPS = [
  { key: "preflight",  label: "Pre-flight checks" },
  { key: "mkdir",      label: "Creating directory" },
  { key: "download",   label: "Downloading WordPress" },
  { key: "extract",    label: "Extracting files" },
  { key: "move",       label: "Moving files" },
  { key: "database",   label: "Creating database" },
  { key: "configure",  label: "Configuring WordPress" },
  { key: "perms",      label: "Setting permissions" },
  { key: "install",    label: "Running installer" },
  { key: "verify",     label: "Verifying installation" },
];

// ── Step tracker ───────────────────────────────────────────────────────────────

async function setStep(serviceId: string, step: string) {
  console.log(`[WP] [${serviceId}] Step: ${step}`);
  await db.update(hostingServicesTable).set({
    wpProvisionStep: step,
    wpProvisionStatus: "provisioning",
    updatedAt: new Date(),
  }).where(eq(hostingServicesTable.id, serviceId));
}

// ── Shell helper ───────────────────────────────────────────────────────────────

async function run(
  cmd: string,
  label: string,
  opts: { timeout?: number; allowFail?: boolean } = {},
): Promise<string> {
  console.log(`[WP] ${label}: ${cmd}`);
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: opts.timeout ?? 120_000 });
    if (stderr?.trim()) console.warn(`[WP] stderr(${label}):`, stderr.trim());
    if (stdout?.trim()) console.log(`[WP] stdout(${label}):`, stdout.trim().substring(0, 300));
    return stdout ?? "";
  } catch (err: any) {
    if (opts.allowFail) {
      console.warn(`[WP] ${label} failed (non-fatal): ${err.message}`);
      return "";
    }
    // Extract the real shell error from the exec output
    const detail = (err.stderr || err.stdout || err.message || "").trim().substring(0, 400);
    throw new Error(`Step "${label}" failed: ${detail}`);
  }
}

// ── MySQL helper ───────────────────────────────────────────────────────────────

async function getMysqlConn(): Promise<mysql2.Connection> {
  return mysql2.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_ROOT_USER,
    password: MYSQL_ROOT_PASS || undefined,
    multipleStatements: false,
    connectTimeout: 10_000,
  });
}

// ── Check if MySQL is reachable ───────────────────────────────────────────────

export async function isMysqlReachable(): Promise<boolean> {
  try {
    const conn = await getMysqlConn();
    await conn.ping();
    await conn.end();
    return true;
  } catch {
    return false;
  }
}

// ── Generate strong credentials ────────────────────────────────────────────────

export function generateWpUsername(domainName: string): string {
  const base = (domainName.split(".")[0] || "admin").replace(/[^a-zA-Z0-9]/g, "").substring(0, 8);
  return `${base}${Math.floor(100 + Math.random() * 900)}`;
}

export function generateWpPassword(): string {
  const chars    = "abcdefghijklmnopqrstuvwxyz";
  const upper    = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits   = "0123456789";
  const specials = "!@#$%";
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  const rest = Array.from({ length: 10 }, () => rand(chars + upper + digits)).join("");
  return `${rand(upper)}${rand(digits)}${rand(specials)}${rest}`;
}

// ── wp-config.php generator ────────────────────────────────────────────────────
// Uses the WP_MYSQL_HOST for the DB_HOST field so WordPress can reach MySQL.
// On most VPS setups this is "localhost" which triggers socket-based connection.

function generateWpConfig(dbName: string, dbUser: string, dbPass: string, dbHost: string): string {
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

// ── Check if WordPress is installed (filesystem) ──────────────────────────────

export async function checkWordPressInstalled(
  domain: string,
  installPath: string = "/",
): Promise<boolean> {
  const subdir     = installPath === "/" ? "" : `/${installPath.replace(/^\//, "")}`;
  const configPath = path.join(VPS_BASE_DIR, domain, "public_html" + subdir, "wp-config.php");
  return fs.existsSync(configPath);
}

// ── Pre-flight validator ───────────────────────────────────────────────────────
// Runs before any install steps. Returns an error string or null if OK.

async function preflight(publicHtml: string): Promise<string | null> {
  // 1. MySQL must be reachable
  const mysqlOk = await isMysqlReachable();
  if (!mysqlOk) {
    return (
      `Cannot connect to MySQL at ${MYSQL_HOST}:${MYSQL_PORT} as '${MYSQL_ROOT_USER}'. ` +
      `Ensure MySQL is running and WP_MYSQL_HOST / WP_MYSQL_ROOT_USER / WP_MYSQL_ROOT_PASS are set correctly.`
    );
  }

  // 2. wget or curl must be present
  let hasWget = false;
  let hasCurl = false;
  try { await execAsync("which wget"); hasWget = true; } catch {}
  try { await execAsync("which curl"); hasCurl = true; } catch {}
  if (!hasWget && !hasCurl) {
    return "Neither 'wget' nor 'curl' is installed on this server. Install one of them to download WordPress.";
  }

  // 3. unzip or tar must be present
  let hasUnzip = false;
  let hasTar   = false;
  try { await execAsync("which unzip"); hasUnzip = true; } catch {}
  try { await execAsync("which tar");   hasTar   = true; } catch {}
  if (!hasUnzip && !hasTar) {
    return "Neither 'unzip' nor 'tar' is installed. Install 'unzip' to extract WordPress.";
  }

  // 4. Parent directory must be writable by this process
  const parentDir = path.dirname(publicHtml);
  try {
    await execAsync(`mkdir -p ${shellEsc(parentDir)}`);
    // quick write test
    const testFile = path.join(parentDir, `.wh_test_${Date.now()}`);
    fs.writeFileSync(testFile, "ok");
    fs.unlinkSync(testFile);
  } catch (e: any) {
    return `Cannot write to '${parentDir}': ${e.message}. Check that the Node.js process has write permission.`;
  }

  console.log(`[WP] Pre-flight passed — MySQL ✓  wget=${hasWget}  curl=${hasCurl}  unzip=${hasUnzip}  tar=${hasTar}`);
  return null;
}

// ── Shell argument escaping ────────────────────────────────────────────────────

function shellEsc(p: string): string {
  return `"${p.replace(/"/g, '\\"')}"`;
}

// ── Main provisioner ───────────────────────────────────────────────────────────
// Priority order when deciding which install path to take:
//   1. cPanel server config provided → use cPanel UAPI + Softaculous/bootstrapper
//   2. MySQL directly reachable on this server → use VPS-direct install
//   3. Neither available → simulation mode (dev/Replit)

export async function provisionWordPress(
  serviceId:   string,
  domain:      string,
  siteTitle:   string,
  wpUser:      string,
  wpPass:      string,
  wpEmail:     string,
  installPath: string = "/",
  cpanelCfg:   { server: CpanelServerConfig; cpanelUser: string } | null = null,
) {
  try {
    // ── Path 1: cPanel / WHM server ──────────────────────────────────────────
    if (cpanelCfg) {
      console.log(`[WP] Using cPanel UAPI path for service ${serviceId} (user: ${cpanelCfg.cpanelUser})`);
      await cpanelProvisionWordPress(cpanelCfg.server, {
        serviceId, domain, cpanelUser: cpanelCfg.cpanelUser,
        siteTitle, wpAdmin: wpUser, wpPass, wpEmail, installPath,
      });
      return;
    }

    // ── Path 2: VPS-direct (MySQL on localhost) ───────────────────────────────
    const mysqlOk = await isMysqlReachable();
    if (mysqlOk) {
      await vpsProvision(serviceId, domain, siteTitle, wpUser, wpPass, wpEmail, installPath);
      return;
    }

    // ── Path 3: Simulation mode (dev / Replit — no MySQL, no cPanel) ──────────
    console.warn(
      `[WP] No cPanel config and MySQL not reachable at ${MYSQL_HOST}:${MYSQL_PORT} — using simulation mode.\n` +
      `     For a real VPS install set: WP_MYSQL_HOST / WP_MYSQL_ROOT_USER / WP_MYSQL_ROOT_PASS\n` +
      `     For cPanel/WHM pass the server config through the install endpoint.`
    );
    await simulateProvision(serviceId, domain, siteTitle, wpUser, wpPass, wpEmail, installPath);
  } catch (err: any) {
    const msg = err?.message || "Unknown error during WordPress provisioning";
    console.error(`[WP] Provisioning failed for ${serviceId}:`, msg);
    await db.update(hostingServicesTable).set({
      wpProvisionStatus: "failed",
      wpProvisionStep:   null,
      wpProvisionError:  msg,
      updatedAt:         new Date(),
    }).where(eq(hostingServicesTable.id, serviceId));
  }
}

// ── Reinstall ──────────────────────────────────────────────────────────────────

export async function reinstallWordPress(
  serviceId:   string,
  domain:      string,
  siteTitle:   string,
  wpUser:      string,
  wpPass:      string,
  wpEmail:     string,
  installPath: string = "/",
  cpanelCfg:   { server: CpanelServerConfig; cpanelUser: string } | null = null,
) {
  console.log(`[WP] Reinstalling WordPress for service ${serviceId}`);

  try {
    const [existing] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, serviceId)).limit(1);
    const oldDbName = (existing as any)?.wpDbName;

    // Reset DB state before wiping/reprovisioning
    await db.update(hostingServicesTable).set({
      wpInstalled:       false,
      wpProvisionStatus: "queued",
      wpProvisionStep:   "Queued",
      wpProvisionError:  null,
      wpUrl:             null,
      wpDbName:          null,
      wpUsername:        wpUser,
      wpPassword:        wpPass,
      wpEmail:           wpEmail,
      wpSiteTitle:       siteTitle,
      wpProvisionedAt:   null,
      updatedAt:         new Date(),
    } as any).where(eq(hostingServicesTable.id, serviceId));

    // ── cPanel reinstall path ─────────────────────────────────────────────────
    if (cpanelCfg) {
      const oldDbUser = (existing as any)?.wpDbName?.replace(/wp\d{6}[a-z0-9]+$/, "wu" + ((existing as any)?.wpDbName?.match(/\d{6}[a-z0-9]+$/)?.[0] || ""));
      await cpanelReinstallWordPress(cpanelCfg.server, {
        serviceId, domain, cpanelUser: cpanelCfg.cpanelUser,
        siteTitle, wpAdmin: wpUser, wpPass, wpEmail, installPath,
      }, oldDbName ?? null, null);
      return;
    }

    // ── VPS-direct reinstall path ─────────────────────────────────────────────
    if (oldDbName) {
      console.log(`[WP] Dropping old database: ${oldDbName}`);
      try {
        const dropConn = await getMysqlConn();
        await dropConn.query(`DROP DATABASE IF EXISTS \`${oldDbName}\``);
        await dropConn.query(`DROP USER IF EXISTS '${oldDbName}'@'localhost'`);
        await dropConn.query(`DROP USER IF EXISTS '${oldDbName}'@'127.0.0.1'`);
        await dropConn.end();
      } catch (dropErr: any) {
        console.warn(`[WP] Could not drop old DB/user (non-fatal): ${dropErr.message}`);
      }
    }

    const subdir     = installPath === "/" ? "" : `/${installPath.replace(/^\//, "")}`;
    const publicHtml = path.join(VPS_BASE_DIR, domain, "public_html" + subdir);
    if (fs.existsSync(publicHtml)) {
      await run(`rm -rf ${shellEsc(publicHtml)}/*`, "Remove old WP files", { allowFail: true });
    }

    await provisionWordPress(serviceId, domain, siteTitle, wpUser, wpPass, wpEmail, installPath, null);
  } catch (err: any) {
    const msg = err?.message || "Reinstall failed";
    console.error(`[WP] Reinstall failed for ${serviceId}:`, msg);
    await db.update(hostingServicesTable).set({
      wpProvisionStatus: "failed",
      wpProvisionError:  msg,
      updatedAt:         new Date(),
    }).where(eq(hostingServicesTable.id, serviceId));
  }
}

// ── VPS direct install ─────────────────────────────────────────────────────────

async function vpsProvision(
  serviceId: string,
  domain: string,
  siteTitle: string,
  wpUser: string,
  wpPass: string,
  wpEmail: string,
  installPath: string,
) {
  const subdir     = installPath === "/" ? "" : `/${installPath.replace(/^\//, "")}`;
  const publicHtml = path.join(VPS_BASE_DIR, domain, "public_html" + subdir);
  const wpUrl      = installPath === "/" ? `https://${domain}` : `https://${domain}${subdir}`;
  const adminUrl   = `${wpUrl}/wp-admin`;

  // Unique suffix — timestamp + random prevents name collisions on retry
  const uid    = `${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5)}`;
  const dbName = `wp_${uid}`.substring(0, 64);
  const dbUser = `wpu_${uid}`.substring(0, 32);
  const dbPass = generateWpPassword();

  const zipPath    = `/tmp/wp_${uid}.zip`;
  const extractDir = `/tmp/wp_extract_${uid}`;

  console.log(`[WP] ── VPS provisioning started ──────────────────────────────`);
  console.log(`[WP] Service:    ${serviceId}`);
  console.log(`[WP] Domain:     ${domain}`);
  console.log(`[WP] PublicHTML: ${publicHtml}`);
  console.log(`[WP] DB:         name=${dbName}  user=${dbUser}`);
  console.log(`[WP] MySQL:      ${MYSQL_HOST}:${MYSQL_PORT} as ${MYSQL_ROOT_USER}`);

  // ── PRE-FLIGHT ─────────────────────────────────────────────────────────────
  await setStep(serviceId, "Pre-flight checks");
  const preflightError = await preflight(publicHtml);
  if (preflightError) throw new Error(preflightError);
  console.log(`[WP] STEP DONE: pre-flight`);

  // ── STEP: Create directory ─────────────────────────────────────────────────
  await setStep(serviceId, "Creating directory");
  await run(`mkdir -p ${shellEsc(publicHtml)}`, "mkdir publicHtml");
  console.log(`[WP] STEP DONE: mkdir ${publicHtml}`);

  // ── STEP: Download WordPress ───────────────────────────────────────────────
  await setStep(serviceId, "Downloading WordPress");
  const WP_ZIP_URL = "https://wordpress.org/latest.zip";
  let downloaded = false;

  // Try wget first, fall back to curl
  try {
    await run(`wget -q ${WP_ZIP_URL} -O ${shellEsc(zipPath)}`, "wget WordPress", { timeout: 120_000 });
    downloaded = true;
    console.log(`[WP] STEP DONE: wget → ${zipPath}`);
  } catch (wgetErr: any) {
    console.warn(`[WP] wget failed (${wgetErr.message}), trying curl…`);
  }

  if (!downloaded) {
    try {
      await run(`curl -sL ${WP_ZIP_URL} -o ${shellEsc(zipPath)}`, "curl WordPress", { timeout: 120_000 });
      downloaded = true;
      console.log(`[WP] STEP DONE: curl → ${zipPath}`);
    } catch (curlErr: any) {
      throw new Error(`Download failed via both wget and curl: ${curlErr.message}`);
    }
  }

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Download failed: ${zipPath} not found on disk after download`);
  }

  const zipStat = fs.statSync(zipPath);
  if (zipStat.size < 100_000) {
    throw new Error(`Downloaded file is too small (${zipStat.size} bytes) — likely an error page from WordPress.org`);
  }
  console.log(`[WP] Download verified: ${(zipStat.size / 1_048_576).toFixed(1)} MB`);

  // ── STEP: Extract zip ──────────────────────────────────────────────────────
  await setStep(serviceId, "Extracting files");
  await run(`mkdir -p ${shellEsc(extractDir)}`, "mkdir extractDir");

  let extracted = false;
  try {
    await run(`unzip -q ${shellEsc(zipPath)} -d ${shellEsc(extractDir)}`, "unzip", { timeout: 60_000 });
    extracted = true;
    console.log(`[WP] STEP DONE: unzip → ${extractDir}`);
  } catch (unzipErr: any) {
    console.warn(`[WP] unzip failed (${unzipErr.message})`);
  }

  // unzip failed — try installing it
  if (!extracted) {
    try {
      console.log(`[WP] Attempting to install unzip via apt-get…`);
      await run("apt-get install -y unzip", "apt-get install unzip", { timeout: 60_000 });
      await run(`unzip -q ${shellEsc(zipPath)} -d ${shellEsc(extractDir)}`, "unzip (retry)", { timeout: 60_000 });
      extracted = true;
      console.log(`[WP] STEP DONE: unzip (after install) → ${extractDir}`);
    } catch (retryErr: any) {
      throw new Error(`Extraction failed: unzip is not available and could not be installed. (${retryErr.message})`);
    }
  }

  // ── STEP: Move files ───────────────────────────────────────────────────────
  await setStep(serviceId, "Moving files");
  const wpSrcDir = path.join(extractDir, "wordpress");
  if (!fs.existsSync(wpSrcDir)) {
    throw new Error(`Extraction produced unexpected layout — expected '${wpSrcDir}' not found. The zip may be corrupt.`);
  }

  await run(`mv ${shellEsc(wpSrcDir)}/* ${shellEsc(publicHtml)}/`, "mv WP files");
  console.log(`[WP] STEP DONE: mv ${wpSrcDir}/* → ${publicHtml}/`);

  // Clean up temp files
  await run(`rm -rf ${shellEsc(zipPath)} ${shellEsc(extractDir)}`, "cleanup tmp", { allowFail: true });

  // Verify index.php arrived before touching the DB
  const indexPath = path.join(publicHtml, "index.php");
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `File move failed: index.php not found at ${indexPath}. ` +
      `Check that the Node.js process has write access to ${publicHtml}`
    );
  }
  console.log(`[WP] index.php present ✓`);

  // ── STEP: Create MySQL database + user ─────────────────────────────────────
  // Uses mysql2 library directly — no shell CLI, no escaping issues.
  // Creates the user for BOTH @'localhost' (socket) and @'127.0.0.1' (TCP)
  // for maximum MySQL configuration compatibility.
  await setStep(serviceId, "Creating database");
  console.log(`[WP] Connecting to MySQL at ${MYSQL_HOST}:${MYSQL_PORT} as ${MYSQL_ROOT_USER}`);
  const mysqlConn = await getMysqlConn();
  try {
    await mysqlConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`[WP] STEP DONE: CREATE DATABASE ${dbName}`);

    // Create user for localhost (socket) and 127.0.0.1 (TCP)
    for (const host of ["localhost", "127.0.0.1"]) {
      await mysqlConn.query(
        `CREATE USER IF NOT EXISTS '${dbUser}'@'${host}' IDENTIFIED BY ?`, [dbPass]
      );
      await mysqlConn.query(
        `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'${host}'`
      );
      console.log(`[WP] STEP DONE: GRANT for ${dbUser}@${host}`);
    }

    await mysqlConn.query(`FLUSH PRIVILEGES`);
    console.log(`[WP] STEP DONE: FLUSH PRIVILEGES`);
  } catch (dbErr: any) {
    // Provide detailed MySQL error to the frontend
    const detail = dbErr?.sqlMessage || dbErr?.message || String(dbErr);
    throw new Error(`Database creation failed: ${detail}`);
  } finally {
    await mysqlConn.end();
  }

  // ── STEP: Write wp-config.php ──────────────────────────────────────────────
  // DB_HOST uses the same host as the mysql2 connection so WordPress can reach the DB.
  await setStep(serviceId, "Configuring WordPress");
  const configPath = path.join(publicHtml, "wp-config.php");
  const wpConfig   = generateWpConfig(dbName, dbUser, dbPass, MYSQL_HOST);
  try {
    fs.writeFileSync(configPath, wpConfig, "utf-8");
  } catch (cfgErr: any) {
    throw new Error(`Could not write wp-config.php to ${configPath}: ${cfgErr.message}`);
  }
  console.log(`[WP] STEP DONE: wp-config.php written → ${configPath}`);

  // ── STEP: Set file permissions ─────────────────────────────────────────────
  await setStep(serviceId, "Setting permissions");
  try {
    await run(`chown -R ${WWW_USER}:${WWW_USER} ${shellEsc(path.join(VPS_BASE_DIR, domain))}`, "chown");
    await run(`chmod -R 755 ${shellEsc(publicHtml)}`, "chmod 755");
    await run(`chmod 640 ${shellEsc(configPath)}`, "chmod wp-config.php");
    console.log(`[WP] STEP DONE: permissions set for ${WWW_USER}`);
  } catch (permErr: any) {
    // Non-fatal — the process may not be root. Log and continue.
    console.warn(`[WP] Warning: could not set file permissions (${permErr.message}). Site may still work.`);
  }

  // ── STEP: Trigger WordPress native installer via HTTP ──────────────────────
  // Best-effort — domain DNS may not resolve yet during provisioning.
  // WordPress will complete setup automatically on first browser visit.
  await setStep(serviceId, "Running installer");
  try {
    console.log(`[WP] POSTing to install.php at ${wpUrl}`);
    const installForm = new URLSearchParams({
      weblog_title:    siteTitle || "My WordPress Site",
      user_name:       wpUser,
      admin_password:  wpPass,
      admin_password2: wpPass,
      admin_email:     wpEmail,
      blog_public:     "1",
    });
    const installResp = await fetch(`${wpUrl}/wp-admin/install.php?step=2`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: installForm.toString(),
      signal: AbortSignal.timeout(20_000),
    });
    console.log(`[WP] STEP DONE: install.php → HTTP ${installResp.status}`);
  } catch (httpErr: any) {
    console.warn(`[WP] install.php skipped (${httpErr.message}) — WP will finish setup on first browser visit.`);
  }

  // ── STEP: Verify both key files exist on disk ──────────────────────────────
  await setStep(serviceId, "Verifying installation");
  const configExists = fs.existsSync(configPath);
  const indexExists  = fs.existsSync(indexPath);
  console.log(`[WP] Verify: wp-config.php=${configExists}  index.php=${indexExists}`);
  if (!configExists || !indexExists) {
    throw new Error(
      `WordPress verification failed — ` +
      `wp-config.php: ${configExists ? "OK" : "MISSING"}, ` +
      `index.php: ${indexExists ? "OK" : "MISSING"} ` +
      `at ${publicHtml}`
    );
  }
  console.log(`[WP] STEP DONE: verification passed ✓`);

  // ── Save success to DB — only after ALL steps + both files confirmed ────────
  await db.update(hostingServicesTable).set({
    wpInstalled:       true,
    wpProvisionStatus: "active",
    wpProvisionStep:   "Completed",
    wpProvisionError:  null,
    wpUrl:             adminUrl,
    wpUsername:        wpUser,
    wpPassword:        wpPass,
    wpEmail:           wpEmail,
    wpSiteTitle:       siteTitle,
    wpDbName:          dbName,
    wpInstallPath:     installPath,
    wpProvisionedAt:   new Date(),
    updatedAt:         new Date(),
  }).where(eq(hostingServicesTable.id, serviceId));

  console.log(`[WP] ── WordPress fully provisioned for service ${serviceId} (${domain}) ──`);
}

// ── Simulation mode ────────────────────────────────────────────────────────────
// Used when MySQL is unreachable (dev/Replit) — simulates all steps with delays.

export async function simulateProvision(
  serviceId: string,
  domain: string,
  siteTitle: string,
  wpUser: string,
  wpPass: string,
  wpEmail: string,
  installPath: string,
) {
  const delay  = (ms: number) => new Promise(r => setTimeout(r, ms));
  const dbName = `wp_${Date.now().toString().slice(-6)}`;

  console.log(`[WP:SIM] Starting simulated install for ${domain}`);

  for (const step of WP_STEPS) {
    await setStep(serviceId, step.label);
    console.log(`[WP INSTALL STEP: ${step.key}]`);
    await delay(2200);
  }
  await delay(800);

  const pathSuffix = installPath === "/" ? "" : `/${installPath.replace(/^\//, "")}`;
  const wpUrl      = `https://${domain}${pathSuffix}`;
  const adminUrl   = `${wpUrl}/wp-admin`;
  const safeId     = serviceId.replace(/-/g, "").substring(0, 12);

  await db.update(hostingServicesTable).set({
    wpInstalled:       true,
    wpProvisionStatus: "active",
    wpProvisionStep:   "Completed",
    wpProvisionError:  null,
    wpUrl:             adminUrl,
    wpUsername:        wpUser,
    wpPassword:        wpPass,
    wpEmail:           wpEmail,
    wpSiteTitle:       siteTitle,
    wpDbName:          dbName,
    wpContainerId:     `sim_wp_${safeId}`,
    wpInstallPath:     installPath,
    wpProvisionedAt:   new Date(),
    updatedAt:         new Date(),
  }).where(eq(hostingServicesTable.id, serviceId));

  console.log(`[WP:SIM] WordPress provisioning complete for ${serviceId}`);
}
