import { exec } from "child_process";
import { promisify } from "util";
import { db } from "@workspace/db";
import { hostingServicesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const execAsync = promisify(exec);

const MYSQL_HOST = process.env.MYSQL_HOST || "127.0.0.1";
const MYSQL_PORT = process.env.MYSQL_PORT || "3306";
const MYSQL_ROOT_USER = process.env.MYSQL_ROOT_USER || "root";
const MYSQL_ROOT_PASSWORD = process.env.MYSQL_ROOT_PASSWORD || "";
const WP_SIMULATE = process.env.WP_SIMULATE === "true";

const WP_STEPS = [
  { key: "container", label: "Creating container" },
  { key: "database", label: "Creating database" },
  { key: "download", label: "Downloading WordPress" },
  { key: "configure", label: "Configuring WordPress" },
  { key: "install", label: "Running installer" },
];

async function setStep(serviceId: string, step: string, extra: Record<string, unknown> = {}) {
  await db.update(hostingServicesTable).set({
    wpProvisionStep: step,
    wpProvisionStatus: "provisioning",
    updatedAt: new Date(),
    ...extra,
  }).where(eq(hostingServicesTable.id, serviceId));
}

async function findFreePort(start = 8090): Promise<number> {
  for (let port = start; port < 9000; port++) {
    try {
      await execAsync(`ss -tlnp | grep -q :${port} || echo free`);
      const result = await execAsync(`ss -tlnp 2>/dev/null | grep -c :${port} || echo 0`);
      if (result.stdout.trim() === "0") return port;
    } catch {
      return port;
    }
  }
  return start + Math.floor(Math.random() * 500);
}

async function waitForWordPress(port: number, timeoutMs = 60000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { stdout } = await execAsync(
        `curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}/wp-admin/install.php --max-time 3`,
      );
      if (stdout.trim() === "200") return true;
    } catch {}
    await new Promise(r => setTimeout(r, 3000));
  }
  return false;
}

export async function provisionWordPress(
  serviceId: string,
  domain: string,
  siteTitle: string,
  wpUser: string,
  wpPass: string,
  wpEmail: string,
) {
  const safeId = serviceId.replace(/-/g, "").substring(0, 12);
  const dbName = `wp_${safeId}`;
  const dbUser = `wp_${safeId}`;
  const dbPass = Math.random().toString(36).slice(2, 10) + "Wp!";
  const containerName = `nexgo_wp_${safeId}`;

  try {
    if (WP_SIMULATE) {
      await simulateProvision(serviceId, domain, siteTitle, wpUser, wpPass, wpEmail, dbName, containerName);
      return;
    }

    const port = await findFreePort();

    // Step 1: Create MySQL database
    await setStep(serviceId, "Creating database");
    const mysqlCmd = `mysql -h ${MYSQL_HOST} -P ${MYSQL_PORT} -u ${MYSQL_ROOT_USER}${MYSQL_ROOT_PASSWORD ? ` -p'${MYSQL_ROOT_PASSWORD}'` : ""} -e "CREATE DATABASE IF NOT EXISTS \`${dbName}\`; CREATE USER IF NOT EXISTS '${dbUser}'@'%' IDENTIFIED BY '${dbPass}'; GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'%'; FLUSH PRIVILEGES;"`;
    await execAsync(mysqlCmd);

    // Step 2: Create Docker container
    await setStep(serviceId, "Creating container", { wpPort: port, wpDbName: dbName });
    const dockerCmd = [
      `docker run -d`,
      `--name ${containerName}`,
      `-p ${port}:80`,
      `-e WORDPRESS_DB_HOST=${MYSQL_HOST}:${MYSQL_PORT}`,
      `-e WORDPRESS_DB_USER=${dbUser}`,
      `-e WORDPRESS_DB_PASSWORD=${dbPass}`,
      `-e WORDPRESS_DB_NAME=${dbName}`,
      `-e WORDPRESS_TABLE_PREFIX=wp_`,
      `wordpress:latest`,
    ].join(" ");
    const { stdout: containerId } = await execAsync(dockerCmd);

    // Step 3: Wait for WordPress to be ready
    await setStep(serviceId, "Downloading WordPress", { wpContainerId: containerId.trim() });
    const ready = await waitForWordPress(port, 120000);
    if (!ready) throw new Error("WordPress container did not become ready in time. Check Docker and MySQL.");

    // Step 4: Run WordPress installer
    await setStep(serviceId, "Running installer");
    const installCmd = [
      `curl -s -X POST http://localhost:${port}/wp-admin/install.php?step=2`,
      `--data-urlencode "weblog_title=${siteTitle}"`,
      `--data-urlencode "user_name=${wpUser}"`,
      `--data-urlencode "admin_password=${wpPass}"`,
      `--data-urlencode "admin_password2=${wpPass}"`,
      `--data-urlencode "admin_email=${wpEmail}"`,
      `--data-urlencode "blog_public=1"`,
    ].join(" ");
    await execAsync(installCmd);

    const wpUrl = `http://${domain}`;
    const adminUrl = `http://${domain}/wp-admin`;

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
      wpContainerId: containerId.trim(),
      wpPort: port,
      wpProvisionedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(hostingServicesTable.id, serviceId));

    console.log(`[WP] Provisioned WordPress for service ${serviceId} at port ${port}`);

  } catch (err: any) {
    const msg = err?.message || "Unknown error";
    console.error(`[WP] Provisioning failed for ${serviceId}:`, msg);
    await db.update(hostingServicesTable).set({
      wpProvisionStatus: "failed",
      wpProvisionStep: null,
      wpProvisionError: msg,
      updatedAt: new Date(),
    }).where(eq(hostingServicesTable.id, serviceId));
  }
}

async function simulateProvision(
  serviceId: string,
  domain: string,
  siteTitle: string,
  wpUser: string,
  wpPass: string,
  wpEmail: string,
  dbName: string,
  containerName: string,
) {
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  for (const step of WP_STEPS) {
    await setStep(serviceId, step.label);
    await delay(2000);
  }

  const port = 8091 + Math.floor(Math.random() * 100);
  const adminUrl = `https://${domain}/wp-admin`;

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
    wpContainerId: `sim_${containerName}`,
    wpPort: port,
    wpProvisionedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(hostingServicesTable.id, serviceId));

  console.log(`[WP:SIM] Simulated WordPress provisioning for ${serviceId}`);
}
