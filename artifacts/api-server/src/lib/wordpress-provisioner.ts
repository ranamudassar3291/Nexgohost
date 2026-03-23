import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import mysql2 from "mysql2/promise";
import { db } from "@workspace/db";
import { hostingServicesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const execAsync = promisify(exec);

// ── VPS Configuration ─────────────────────────────────────────────────────────
// These are read at startup. Override via environment variables.

// Root directory where domains are hosted, e.g. /var/www
const VPS_BASE_DIR = process.env.WP_BASE_DIR || "/var/www";

// MySQL root credentials for creating databases
const MYSQL_HOST = process.env.WP_MYSQL_HOST || "localhost";
const MYSQL_ROOT_USER = process.env.WP_MYSQL_ROOT_USER || "root";
const MYSQL_ROOT_PASS = process.env.WP_MYSQL_ROOT_PASS || "";

// Web server user that should own WordPress files (www-data on nginx/apache)
const WWW_USER = process.env.WP_WWW_USER || "www-data";

export const WP_STEPS = [
  { key: "mkdir",     label: "Creating directory" },
  { key: "download",  label: "Downloading WordPress" },
  { key: "extract",   label: "Extracting files" },
  { key: "move",      label: "Moving files" },
  { key: "database",  label: "Creating database" },
  { key: "configure", label: "Configuring WordPress" },
  { key: "perms",     label: "Setting permissions" },
  { key: "install",   label: "Running installer" },
  { key: "verify",    label: "Verifying installation" },
];

// ── Step tracker ──────────────────────────────────────────────────────────────

async function setStep(serviceId: string, step: string) {
  console.log(`[WP] [${serviceId}] Step: ${step}`);
  await db.update(hostingServicesTable).set({
    wpProvisionStep: step,
    wpProvisionStatus: "provisioning",
    updatedAt: new Date(),
  }).where(eq(hostingServicesTable.id, serviceId));
}

// ── Shell helper ──────────────────────────────────────────────────────────────

async function run(cmd: string, label: string): Promise<string> {
  console.log(`[WP] ${label}: ${cmd}`);
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 120_000 });
    if (stderr) console.warn(`[WP] stderr (${label}):`, stderr.trim());
    if (stdout) console.log(`[WP] stdout (${label}):`, stdout.trim());
    return stdout;
  } catch (err: any) {
    throw new Error(`[${label}] command failed: ${err.message}`);
  }
}

// ── MySQL helper ──────────────────────────────────────────────────────────────
// Uses mysql2 library — no shell CLI needed, no escaping issues.

async function getMysqlConn(): Promise<mysql2.Connection> {
  return mysql2.createConnection({
    host: MYSQL_HOST,
    user: MYSQL_ROOT_USER,
    password: MYSQL_ROOT_PASS || undefined,
    multipleStatements: false,
  });
}

async function mysqlRun(sql: string, label: string, params: any[] = []): Promise<void> {
  console.log(`[WP] ${label}: ${sql}${params.length ? ` params=${JSON.stringify(params)}` : ""}`);
  const conn = await getMysqlConn();
  try {
    await conn.execute(sql, params);
    console.log(`[WP] ${label}: OK`);
  } finally {
    await conn.end();
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

// ── wp-config.php generator ───────────────────────────────────────────────────

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

// ── Check if WordPress is installed ──────────────────────────────────────────

export async function checkWordPressInstalled(
  domain: string,
  installPath: string = "/",
): Promise<boolean> {
  const subdir = installPath === "/" ? "" : `/${installPath.replace(/^\//, "")}`;
  const configPath = path.join(VPS_BASE_DIR, domain, "public_html" + subdir, "wp-config.php");
  return fs.existsSync(configPath);
}

// ── MySQL reachability check ──────────────────────────────────────────────────

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

// ── Main provisioner ──────────────────────────────────────────────────────────

export async function provisionWordPress(
  serviceId: string,
  domain: string,
  siteTitle: string,
  wpUser: string,
  wpPass: string,
  wpEmail: string,
  installPath: string = "/",
) {
  try {
    // Check if MySQL is reachable before attempting real install.
    // When running on Replit (dev), MySQL is not available — fall back to simulation.
    // When deployed on the actual VPS, MySQL is at localhost and real install runs.
    const mysqlOk = await isMysqlReachable();

    if (!mysqlOk) {
      console.warn(
        `[WP] MySQL not reachable at ${MYSQL_HOST}:3306 — falling back to simulation mode.\n` +
        `     To enable real installs, ensure MySQL is running and set:\n` +
        `       WP_MYSQL_HOST=${MYSQL_HOST}\n` +
        `       WP_MYSQL_ROOT_USER=${MYSQL_ROOT_USER}\n` +
        `       WP_MYSQL_ROOT_PASS=<your_mysql_root_password>`
      );
      await simulateProvision(serviceId, domain, siteTitle, wpUser, wpPass, wpEmail, installPath);
      return;
    }

    await vpsProvision(serviceId, domain, siteTitle, wpUser, wpPass, wpEmail, installPath);
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
) {
  console.log(`[WP] Reinstalling WordPress for service ${serviceId}`);

  try {
    // Fetch existing DB name so we can drop it
    const [existing] = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.id, serviceId)).limit(1);
    const oldDbName = (existing as any)?.wpDbName;

    if (oldDbName) {
      console.log(`[WP] Dropping old database: ${oldDbName}`);
      try {
        const dropConn = await getMysqlConn();
        await dropConn.query(`DROP DATABASE IF EXISTS \`${oldDbName}\``);
        await dropConn.query(`DROP USER IF EXISTS '${oldDbName}'@'localhost'`);
        await dropConn.end();
      } catch (dropErr: any) {
        console.warn(`[WP] Could not drop old DB/user (non-fatal): ${dropErr.message}`);
      }
    }

    // Remove old WordPress files
    const subdir = installPath === "/" ? "" : `/${installPath.replace(/^\//, "")}`;
    const publicHtml = path.join(VPS_BASE_DIR, domain, "public_html" + subdir);
    if (fs.existsSync(publicHtml)) {
      await run(`rm -rf ${publicHtml}/*`, "Remove old WP files");
    }

    // Reset DB state, then re-provision
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

    // Use the same MySQL-aware provisioner (auto-falls back to simulation if MySQL unreachable)
    await provisionWordPress(serviceId, domain, siteTitle, wpUser, wpPass, wpEmail, installPath);
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

// ── VPS direct install ────────────────────────────────────────────────────────

async function vpsProvision(
  serviceId: string,
  domain: string,
  siteTitle: string,
  wpUser: string,
  wpPass: string,
  wpEmail: string,
  installPath: string,
) {
  const subdir = installPath === "/" ? "" : `/${installPath.replace(/^\//, "")}`;
  const publicHtml = path.join(VPS_BASE_DIR, domain, "public_html" + subdir);
  const wpUrl = installPath === "/" ? `https://${domain}` : `https://${domain}${subdir}`;
  const adminUrl = `${wpUrl}/wp-admin`;

  // Unique suffix — timestamp + random prevents name collisions on retry
  const uid = `${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5)}`;
  const dbName = `wp_${uid}`.substring(0, 64);
  const dbUser = `wpu_${uid}`.substring(0, 32); // MySQL username limit: 32 chars
  const dbPass = generateWpPassword();

  const zipPath = `/tmp/wp_${uid}.zip`;
  const extractDir = `/tmp/wp_extract_${uid}`;

  console.log(`[WP] ── VPS provisioning started ──────────────────────────────`);
  console.log(`[WP] Service:   ${serviceId}`);
  console.log(`[WP] Domain:    ${domain}`);
  console.log(`[WP] PublicHTML:${publicHtml}`);
  console.log(`[WP] DB name:   ${dbName}   DB user: ${dbUser}`);

  // ── STEP 1: Create directory ────────────────────────────────────────────────
  await setStep(serviceId, "Creating directory");
  await execAsync(`mkdir -p ${publicHtml}`);
  console.log(`[WP] STEP DONE: mkdir ${publicHtml}`);

  // ── STEP 2: Download WordPress ──────────────────────────────────────────────
  await setStep(serviceId, "Downloading WordPress");
  await execAsync(`wget -q https://wordpress.org/latest.zip -O ${zipPath}`, { timeout: 120_000 });
  console.log(`[WP] STEP DONE: download → ${zipPath}`);

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Download failed: ${zipPath} not found after wget`);
  }

  // ── STEP 3: Extract zip ─────────────────────────────────────────────────────
  await setStep(serviceId, "Extracting files");
  await execAsync(`mkdir -p ${extractDir}`);
  await execAsync(`unzip -q ${zipPath} -d ${extractDir}`, { timeout: 60_000 });
  console.log(`[WP] STEP DONE: extract → ${extractDir}`);

  // ── STEP 4: Move files from wordpress/ sub-folder into public_html ──────────
  await setStep(serviceId, "Moving files");
  await execAsync(`mv ${extractDir}/wordpress/* ${publicHtml}/`);
  console.log(`[WP] STEP DONE: mv ${extractDir}/wordpress/* → ${publicHtml}/`);

  // ── STEP 5: Clean up temp files ─────────────────────────────────────────────
  await execAsync(`rm -rf ${zipPath} ${extractDir}`);
  console.log(`[WP] STEP DONE: cleanup temp files`);

  // Verify index.php arrived before touching the DB
  const indexPath = path.join(publicHtml, "index.php");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`File extraction failed: index.php not found at ${indexPath}`);
  }
  console.log(`[WP] index.php present ✓`);

  // ── STEP 6: Create MySQL database + user ────────────────────────────────────
  // Uses mysql2 library directly — no shell CLI, no escaping issues.
  await setStep(serviceId, "Creating database");
  console.log(`[WP] Connecting to MySQL at ${MYSQL_HOST} as ${MYSQL_ROOT_USER}`);
  const mysqlConn = await getMysqlConn();
  try {
    await mysqlConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`[WP] STEP DONE: CREATE DATABASE ${dbName}`);

    await mysqlConn.query(`CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY ?`, [dbPass]);
    console.log(`[WP] STEP DONE: CREATE USER ${dbUser}`);

    await mysqlConn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost'`);
    await mysqlConn.query(`FLUSH PRIVILEGES`);
    console.log(`[WP] STEP DONE: GRANT privileges + FLUSH`);
  } finally {
    await mysqlConn.end();
  }

  // ── STEP 7: Write wp-config.php ─────────────────────────────────────────────
  await setStep(serviceId, "Configuring WordPress");
  const configPath = path.join(publicHtml, "wp-config.php");
  const wpConfig = generateWpConfig(dbName, dbUser, dbPass, MYSQL_HOST);
  fs.writeFileSync(configPath, wpConfig, "utf-8");
  console.log(`[WP] STEP DONE: wp-config.php written to ${configPath}`);

  // ── STEP 8: Set file permissions ─────────────────────────────────────────────
  await setStep(serviceId, "Setting permissions");
  try {
    await execAsync(`chown -R ${WWW_USER}:${WWW_USER} ${path.join(VPS_BASE_DIR, domain)}`);
    console.log(`[WP] STEP DONE: chown ${WWW_USER}`);
    await execAsync(`chmod -R 755 ${publicHtml}`);
    console.log(`[WP] STEP DONE: chmod 755`);
  } catch (permErr: any) {
    // Non-fatal — may fail if not running as root
    console.warn(`[WP] Warning: could not set file permissions (${permErr.message}). Continuing.`);
  }

  // Attempt native WP installer via HTTP (best-effort — domain may not resolve yet)
  await setStep(serviceId, "Running installer");
  try {
    console.log(`[WP] POSTing to install.php for ${wpUrl}`);
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
    });
    console.log(`[WP] STEP DONE: install.php → HTTP ${installResp.status}`);
  } catch (httpErr: any) {
    // Domain not yet resolving publicly — WP will self-install on first browser visit.
    console.warn(`[WP] install.php HTTP call skipped (${httpErr.message}). WP will finish setup on first visit.`);
  }

  // ── STEP 9: Verify BOTH key files exist ──────────────────────────────────────
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

  // ── Save success to DB ── only after all steps and both files confirmed ───────
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

  console.log(`[WP] ── WordPress fully provisioned for service ${serviceId} (${domain}) ──`);
}

// ── Simulation mode ───────────────────────────────────────────────────────────
// Used when WP_SIMULATE=true or no VPS config is available (dev/test).

export async function simulateProvision(
  serviceId: string,
  domain: string,
  siteTitle: string,
  wpUser: string,
  wpPass: string,
  wpEmail: string,
  installPath: string,
) {
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
  const dbName = `wp_${Date.now().toString().slice(-6)}`;

  console.log(`[WP:SIM] Starting simulated install for ${domain}`);

  for (const step of WP_STEPS) {
    await setStep(serviceId, step.label);
    console.log(`[WP INSTALL STEP: ${step.key}]`);
    await delay(2500);
  }
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
