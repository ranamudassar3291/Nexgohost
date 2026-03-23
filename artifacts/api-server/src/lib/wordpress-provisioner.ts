import { exec } from "child_process";
import { promisify } from "util";
import { db } from "@workspace/db";
import { hostingServicesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const execAsync = promisify(exec);

const WP_SIMULATE = process.env.WP_SIMULATE === "true";

export const WP_STEPS = [
  { key: "database",  label: "Creating database" },
  { key: "download",  label: "Downloading WordPress" },
  { key: "extract",   label: "Extracting files" },
  { key: "configure", label: "Configuring WordPress" },
  { key: "install",   label: "Running installer" },
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

async function cpanelUAPI(
  ctx: CpanelCtx,
  module: string,
  fn: string,
  params: Record<string, string> = {},
): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const url = `${ctx.baseUrl}execute/${module}/${fn}?${qs}`;
  const creds = Buffer.from(`${ctx.username}:${ctx.password}`).toString("base64");
  const resp = await fetch(url, {
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/json" },
  });
  if (!resp.ok) throw new Error(`cPanel API error: ${resp.status} ${resp.statusText}`);
  const json: any = await resp.json();
  if (json.status === 0) throw new Error(json.errors?.[0] || "cPanel API returned an error");
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
  const safeId = serviceId.replace(/-/g, "").substring(0, 12);
  const dbName = `wp_${safeId}`;
  const dbUser = `wp_${safeId}`;
  const dbPass = generateWpPassword();

  try {
    if (WP_SIMULATE || !cpanelCtx) {
      await simulateProvision(serviceId, domain, siteTitle, wpUser, wpPass, wpEmail, installPath, dbName);
      return;
    }
    await cpanelProvision(serviceId, domain, siteTitle, wpUser, wpPass, wpEmail, installPath, dbName, dbUser, dbPass, cpanelCtx);
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
    // Remove old WP files via cPanel
    if (cpanelCtx && !WP_SIMULATE) {
      const dir = installPath === "/" ? "/public_html" : `/public_html/${installPath.replace(/^\//, "")}`;
      const wpFiles = ["wp-admin", "wp-content", "wp-includes", "wp-config.php", "wp-login.php", "index.php", "wp-blog-header.php"];
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
      wpUsername: wpUser,
      wpPassword: wpPass,
      wpEmail: wpEmail,
      wpSiteTitle: siteTitle,
      updatedAt: new Date(),
    }).where(eq(hostingServicesTable.id, serviceId));

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
  dbName: string,
  dbUser: string,
  dbPass: string,
  ctx: CpanelCtx,
) {
  const publicHtml = installPath === "/" ? "/public_html" : `/public_html/${installPath.replace(/^\//, "")}`;
  const wpUrl = installPath === "/" ? `https://${domain}` : `https://${domain}/${installPath.replace(/^\//, "")}`;
  const adminUrl = `${wpUrl}/wp-admin`;

  // STEP 1: Create MySQL database
  await setStep(serviceId, "Creating database");
  console.log(`[WP] Creating database: ${dbName}`);
  await cpanelUAPI(ctx, "Mysql", "create_database", { name: dbName });
  await cpanelUAPI(ctx, "Mysql", "create_user", { name: dbUser, password: dbPass });
  await cpanelUAPI(ctx, "Mysql", "set_privileges_on_database", {
    database: dbName, dbuser: dbUser, privileges: "ALL PRIVILEGES",
  });
  console.log(`[WP] Database created: ${dbName}`);

  // STEP 2: Download WordPress
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

  // STEP 4: Create wp-config.php
  await setStep(serviceId, "Configuring WordPress");
  console.log(`[WP] Creating wp-config.php`);
  const wpConfigContent = generateWpConfig(dbName, dbUser, dbPass, ctx.username);
  await cpanelUAPI(ctx, "Fileman", "save_file_content", {
    dir: publicHtml,
    file: "wp-config.php",
    content: wpConfigContent,
  });

  // STEP 5: Run WordPress installer
  await setStep(serviceId, "Running installer");
  console.log(`[WP] Running WordPress installer`);
  const installResp = await fetch(`${wpUrl}/wp-admin/install.php?step=2`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      weblog_title: siteTitle,
      user_name: wpUser,
      admin_password: wpPass,
      admin_password2: wpPass,
      admin_email: wpEmail,
      blog_public: "1",
    }),
  });

  if (!installResp.ok && installResp.status !== 302) {
    throw new Error(`WordPress installer returned HTTP ${installResp.status}`);
  }

  console.log(`[WP] WordPress installed successfully for ${domain}`);

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
    console.log(`[WP:SIM] Simulating: ${step.label}`);
    await delay(2500);
  }

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
