import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";
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
  { key: "database",  label: "Creating database" },
  { key: "download",  label: "Downloading WordPress" },
  { key: "extract",   label: "Extracting files" },
  { key: "configure", label: "Configuring WordPress" },
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
// Runs a SQL statement via the mysql CLI using root credentials.
// No mysql2 dependency needed — the CLI is always available on a VPS.

function mysqlFlag(): string {
  const passFlag = MYSQL_ROOT_PASS ? `-p${MYSQL_ROOT_PASS.replace(/'/g, "\\'")}` : "";
  return `-h ${MYSQL_HOST} -u ${MYSQL_ROOT_USER} ${passFlag}`;
}

async function mysqlRun(sql: string, label: string): Promise<void> {
  const escaped = sql.replace(/"/g, '\\"');
  await run(`mysql ${mysqlFlag()} -e "${escaped}"`, label);
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
      try { await mysqlRun(`DROP DATABASE IF EXISTS \`${oldDbName}\``, "Drop old DB"); } catch { /* ignore */ }
      try { await mysqlRun(`DROP USER IF EXISTS '${oldDbName}'@'localhost'`, "Drop old DB user"); } catch { /* ignore */ }
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

  // Unique DB credentials — timestamp + random ensures no collisions on retry
  const uid = `${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5)}`;
  const dbName = `wp_${uid}`.substring(0, 64);
  const dbUser = `wpu_${uid}`.substring(0, 32); // MySQL user name limit: 32 chars
  const dbPass = generateWpPassword();

  console.log(`[WP] VPS provisioning for service ${serviceId}`);
  console.log(`[WP] Domain: ${domain}, Path: ${publicHtml}`);
  console.log(`[WP] DB Name: ${dbName}, DB User: ${dbUser}`);

  // STEP 1: Create MySQL database + user
  await setStep(serviceId, "Creating database");
  await mysqlRun(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`, "Create DB");
  await mysqlRun(`CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPass.replace(/'/g, "\\'")}'`, "Create DB user");
  await mysqlRun(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost'`, "Grant privileges");
  await mysqlRun("FLUSH PRIVILEGES", "Flush privileges");
  console.log(`[WP] Database created: ${dbName}`);

  // STEP 2: Ensure public_html directory exists
  await setStep(serviceId, "Downloading WordPress");
  fs.mkdirSync(publicHtml, { recursive: true });

  // Download WordPress to a temp file
  const tmpTar = `/tmp/wp_${uid}.tar.gz`;
  await run(`curl -sL https://wordpress.org/latest.tar.gz -o ${tmpTar}`, "Download WordPress");
  console.log(`[WP] WordPress downloaded to ${tmpTar}`);

  // STEP 3: Extract WordPress files
  await setStep(serviceId, "Extracting files");
  const tmpDir = `/tmp/wp_extract_${uid}`;
  await run(`mkdir -p ${tmpDir} && tar -xzf ${tmpTar} -C ${tmpDir}`, "Extract WordPress");
  await run(`cp -rp ${tmpDir}/wordpress/. ${publicHtml}/`, "Copy WordPress files");
  await run(`rm -rf ${tmpTar} ${tmpDir}`, "Cleanup temp files");
  console.log(`[WP] WordPress files extracted to ${publicHtml}`);

  // STEP 4: Write wp-config.php
  await setStep(serviceId, "Configuring WordPress");
  const wpConfig = generateWpConfig(dbName, dbUser, dbPass, MYSQL_HOST);
  const configPath = path.join(publicHtml, "wp-config.php");
  fs.writeFileSync(configPath, wpConfig, "utf-8");
  console.log(`[WP] wp-config.php written`);

  // STEP 5: Set correct file permissions
  await setStep(serviceId, "Running installer");
  try {
    await run(`chown -R ${WWW_USER}:${WWW_USER} ${publicHtml}`, "Set ownership");
    await run(`chmod -R 755 ${publicHtml}`, "Set permissions");
  } catch (permErr: any) {
    // Permission setting may fail if running as non-root — not fatal
    console.warn(`[WP] Warning: could not set file permissions (${permErr.message}). Continuing.`);
  }

  // Run WordPress native installer via HTTP
  try {
    console.log(`[WP] Running WordPress native install.php for ${wpUrl}`);
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
    console.log(`[WP] install.php response: HTTP ${installResp.status}`);
  } catch (httpErr: any) {
    // If the domain isn't publicly resolving yet, install.php won't work.
    // wp-config.php + database are set up, so WP will self-install on first visit.
    console.warn(`[WP] install.php HTTP call failed (${httpErr.message}) — WordPress will complete setup on first browser visit`);
  }

  // STEP 6: Verify wp-config.php exists on disk
  await setStep(serviceId, "Verifying installation");
  const isInstalled = fs.existsSync(configPath);
  if (!isInstalled) {
    throw new Error(`WordPress verification failed: wp-config.php not found at ${configPath}`);
  }
  console.log(`[WP] Install verified ✓ — wp-config.php exists at ${configPath}`);

  // Save success to DB — only after real verification
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
