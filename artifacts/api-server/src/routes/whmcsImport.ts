/**
 * WHMCS → Nexgohost Full Migration System
 * Imports: TLD extensions, hosting plans, servers, clients (with passwords),
 *          hosting services, domains, orders, and invoices.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  hostingPlansTable,
  hostingServicesTable,
  domainsTable,
  domainExtensionsTable,
  domainPricingTable,
  invoicesTable,
  ordersTable,
  serversTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { createHash } from "crypto";

const router = Router();

// ── In-memory job tracker ─────────────────────────────────────────────────────
interface ImportJob {
  jobId: string;
  status: "running" | "completed" | "failed";
  step: string;
  stepIndex: number;
  totalSteps: number;
  current: number;
  total: number;
  logs: string[];
  result: {
    extensions: number;
    plans: number;
    servers: number;
    clients: number;
    services: number;
    domains: number;
    orders: number;
    invoices: number;
    skipped: number;
    errors: number;
  };
  startedAt: string;
  completedAt?: string;
}

const jobs = new Map<string, ImportJob>();

// ── WHMCS API helpers ─────────────────────────────────────────────────────────
async function callWhmcs(
  baseUrl: string,
  identifier: string,
  secret: string,
  action: string,
  params: Record<string, any> = {},
): Promise<any> {
  const url = baseUrl.replace(/\/$/, "") + "/includes/api.php";
  const body = new URLSearchParams({
    identifier,
    secret,
    action,
    responsetype: "json",
    ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ),
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok)
    throw new Error(`WHMCS HTTP ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (data.result === "error")
    throw new Error(`WHMCS API: ${data.message}`);
  return data;
}

async function fetchAllPages(
  baseUrl: string,
  identifier: string,
  secret: string,
  action: string,
  dataKey: string,
  subKey: string,
  extra: Record<string, any> = {},
): Promise<any[]> {
  const all: any[] = [];
  let start = 0;
  const limit = 250;
  while (true) {
    const data = await callWhmcs(baseUrl, identifier, secret, action, {
      limitstart: start,
      limitnum: limit,
      ...extra,
    });
    const container = data[dataKey];
    if (!container) break;
    const records = container[subKey];
    if (!records) break;
    const arr = Array.isArray(records) ? records : [records];
    all.push(...arr);
    const total = parseInt(data.totalresults ?? data.numresults ?? "0");
    start += arr.length;
    if (start >= total || arr.length === 0) break;
  }
  return all;
}

// Run N async tasks with limited concurrency
async function batchRun<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<void>,
): Promise<void> {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx).catch(() => {});
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// ── Mapping helpers ───────────────────────────────────────────────────────────
function mapClientStatus(s: string): "active" | "inactive" | "suspended" {
  if (s === "Active") return "active";
  if (s === "Inactive") return "inactive";
  return "suspended";
}

function mapServiceStatus(
  s: string,
): "active" | "suspended" | "terminated" | "pending" {
  const m: Record<string, any> = {
    Active: "active",
    Suspended: "suspended",
    Terminated: "terminated",
    Cancelled: "terminated",
    Pending: "pending",
  };
  return m[s] ?? "pending";
}

function mapDomainStatus(
  s: string,
): "active" | "expired" | "pending" | "cancelled" | "transferred" | "suspended" {
  const m: Record<string, any> = {
    Active: "active",
    Expired: "expired",
    Pending: "pending",
    Cancelled: "cancelled",
    Redemption: "expired",
    "Transferred Away": "transferred",
    Suspended: "suspended",
  };
  return m[s] ?? "pending";
}

function mapInvoiceStatus(
  s: string,
): "paid" | "unpaid" | "cancelled" | "refunded" | "overdue" {
  const m: Record<string, any> = {
    Paid: "paid",
    Unpaid: "unpaid",
    Cancelled: "cancelled",
    Refunded: "refunded",
    Collections: "overdue",
    "Payment Pending": "unpaid",
  };
  return m[s] ?? "unpaid";
}

function mapOrderStatus(s: string): "approved" | "pending" | "cancelled" | "fraud" {
  const m: Record<string, any> = {
    Active: "approved",
    Pending: "pending",
    Cancelled: "cancelled",
    Fraud: "fraud",
    Failed: "cancelled",
    Refunded: "cancelled",
  };
  return m[s] ?? "pending";
}

function mapBillingCycle(s: string): string {
  const m: Record<string, string> = {
    Monthly: "monthly",
    Quarterly: "quarterly",
    "Semi-Annually": "semi-annually",
    Annually: "annually",
    Biennially: "annually",
    Triennially: "annually",
    "Free Account": "monthly",
    "One Time": "monthly",
  };
  return m[s] ?? "monthly";
}

function parseDate(d: string | null | undefined): Date | null {
  if (!d || d === "0000-00-00" || d === "" || d === "0000-00-00 00:00:00")
    return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function splitDomain(full: string): { name: string; tld: string } {
  const parts = full.toLowerCase().split(".");
  // Handle multi-part TLDs like .co.uk, .com.pk
  if (
    parts.length >= 3 &&
    ["co", "com", "net", "org", "gov", "edu", "ac"].includes(
      parts[parts.length - 2],
    )
  ) {
    return {
      name: parts.slice(0, -2).join("."),
      tld: "." + parts.slice(-2).join("."),
    };
  }
  if (parts.length >= 2) {
    return {
      name: parts.slice(0, -1).join("."),
      tld: "." + parts[parts.length - 1],
    };
  }
  return { name: full, tld: "" };
}

function normalizePasswordHash(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const h = hash.trim();
  if (!h) return null;
  // PHP $2y$ bcrypt → Node.js $2b$ (same algorithm, different prefix)
  if (h.startsWith("$2y$")) return h.replace("$2y$", "$2b$");
  // Standard bcrypt — use as-is
  if (h.startsWith("$2a$") || h.startsWith("$2b$")) return h;
  // Legacy MD5 (32 hex chars) — prefix so login can detect
  if (/^[a-f0-9]{32}$/i.test(h)) return `whmcs_md5:${h}`;
  // Unknown — store with prefix, will fall through to bcrypt compare
  return `whmcs_md5:${h}`;
}

function getPrice(pricing: any, cycle: string): string | null {
  const currency = Object.keys(pricing ?? {})[0] ?? "USD";
  const p = pricing?.[currency]?.[cycle];
  if (!p || p === "-1" || parseFloat(p) <= 0) return null;
  return parseFloat(p).toFixed(2);
}

// ── Test connection ───────────────────────────────────────────────────────────
router.post(
  "/admin/whmcs/test",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { whmcsUrl, identifier, secret } = req.body;
      if (!whmcsUrl || !identifier || !secret) {
        res.status(400).json({ error: "whmcsUrl, identifier, and secret are required" });
        return;
      }
      const data = await callWhmcs(whmcsUrl, identifier, secret, "GetClients", {
        limitnum: 1,
      });
      res.json({
        success: true,
        message: `Connected! Found ${data.totalresults ?? 0} clients in WHMCS.`,
        totalClients: parseInt(data.totalresults ?? "0"),
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  },
);

// ── Preview ───────────────────────────────────────────────────────────────────
router.post(
  "/admin/whmcs/preview",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { whmcsUrl, identifier, secret } = req.body;
      if (!whmcsUrl || !identifier || !secret) {
        res.status(400).json({ error: "Missing credentials" });
        return;
      }
      const [clients, products, services, domains, invoices, orders] =
        await Promise.all([
          callWhmcs(whmcsUrl, identifier, secret, "GetClients", { limitnum: 1 }),
          callWhmcs(whmcsUrl, identifier, secret, "GetProducts", { limitnum: 1 }),
          callWhmcs(whmcsUrl, identifier, secret, "GetClientsProducts", { limitnum: 1 }),
          callWhmcs(whmcsUrl, identifier, secret, "GetClientsDomains", { limitnum: 1 }),
          callWhmcs(whmcsUrl, identifier, secret, "GetInvoices", { limitnum: 1 }),
          callWhmcs(whmcsUrl, identifier, secret, "GetOrders", { limitnum: 1 }),
        ]);

      let tldCount = 0;
      try {
        const tld = await callWhmcs(whmcsUrl, identifier, secret, "GetTldPricing");
        tldCount = Object.keys(tld.pricing ?? {}).length;
      } catch {}

      res.json({
        clients: parseInt(clients.totalresults ?? "0"),
        plans: parseInt(products.totalresults ?? "0"),
        services: parseInt(services.totalresults ?? "0"),
        domains: parseInt(domains.totalresults ?? "0"),
        invoices: parseInt(invoices.totalresults ?? "0"),
        orders: parseInt(orders.totalresults ?? "0"),
        extensions: tldCount,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
);

// ── Start full import ─────────────────────────────────────────────────────────
router.post(
  "/admin/whmcs/import",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const { whmcsUrl, identifier, secret, options = {} } = req.body;
    if (!whmcsUrl || !identifier || !secret) {
      res.status(400).json({ error: "Missing credentials" });
      return;
    }

    const jobId = crypto.randomUUID();
    const job: ImportJob = {
      jobId,
      status: "running",
      step: "Starting…",
      stepIndex: 0,
      totalSteps: 8,
      current: 0,
      total: 0,
      logs: ["[INFO] WHMCS migration started"],
      startedAt: new Date().toISOString(),
      result: {
        extensions: 0,
        plans: 0,
        servers: 0,
        clients: 0,
        services: 0,
        domains: 0,
        orders: 0,
        invoices: 0,
        skipped: 0,
        errors: 0,
      },
    };
    jobs.set(jobId, job);

    const log = (msg: string) => {
      job.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    };
    const errLog = (msg: string) => {
      job.logs.push(`[ERR] ${msg}`);
      job.result.errors++;
    };

    const setStep = (name: string, idx: number) => {
      job.step = name;
      job.stepIndex = idx;
      job.current = 0;
      job.total = 0;
      log(`── Step ${idx}/8: ${name}`);
    };

    // Run async in background
    (async () => {
      try {
        const importExtensions: boolean = options.importExtensions !== false;
        const importPlans: boolean = options.importPlans !== false;
        const importServers: boolean = options.importServers !== false;
        const importClients: boolean = options.importClients !== false;
        const importPasswords: boolean = options.importPasswords !== false;
        const importServices: boolean = options.importServices !== false;
        const importDomains: boolean = options.importDomains !== false;
        const importOrders: boolean = options.importOrders !== false;
        const importInvoices: boolean = options.importInvoices !== false;
        const skipExistingClients: boolean = options.skipExistingClients !== false;

        // ID maps: WHMCS id → our UUID
        const clientIdMap = new Map<string, string>();
        const planIdMap = new Map<string, string>();
        const serverIdMap = new Map<string, string>();
        const serviceIdMap = new Map<string, string>(); // WHMCS service id → our id
        const invoiceIdMap = new Map<string, string>();
        let defaultPlanId = "";

        // ── 1. TLD Extensions ─────────────────────────────────────────────
        if (importExtensions) {
          setStep("Importing TLD extensions & pricing", 1);
          try {
            const tldData = await callWhmcs(
              whmcsUrl, identifier, secret, "GetTldPricing",
            );
            const pricing = tldData.pricing ?? {};
            const tlds = Object.keys(pricing);
            job.total = tlds.length;
            log(`Found ${tlds.length} TLD extensions in WHMCS`);

            for (const tld of tlds) {
              job.current++;
              const ext = tld.startsWith(".") ? tld : `.${tld}`;
              const p = pricing[tld];
              const regPrice = parseFloat(p?.register?.["1"] ?? "0") || 0;
              const renPrice = parseFloat(p?.renew?.["1"] ?? p?.renewal?.["1"] ?? "0") || regPrice;
              const trfPrice = parseFloat(p?.transfer?.["1"] ?? "0") || regPrice;

              if (regPrice <= 0) continue; // skip free/invalid

              try {
                // Upsert into domain_extensions
                await db
                  .insert(domainExtensionsTable)
                  .values({
                    extension: ext,
                    registerPrice: String(regPrice.toFixed(2)),
                    renewalPrice: String(renPrice.toFixed(2)),
                    transferPrice: String(trfPrice.toFixed(2)),
                    register2YearPrice: p?.register?.["2"]
                      ? String(parseFloat(p.register["2"]).toFixed(2))
                      : null,
                    register3YearPrice: p?.register?.["3"]
                      ? String(parseFloat(p.register["3"]).toFixed(2))
                      : null,
                    status: "active",
                  } as any)
                  .onConflictDoUpdate({
                    target: domainExtensionsTable.extension,
                    set: {
                      registerPrice: String(regPrice.toFixed(2)),
                      renewalPrice: String(renPrice.toFixed(2)),
                      transferPrice: String(trfPrice.toFixed(2)),
                    },
                  });

                // Also upsert into domain_pricing
                await db
                  .insert(domainPricingTable)
                  .values({
                    tld: ext,
                    registrationPrice: String(regPrice.toFixed(2)),
                    renewalPrice: String(renPrice.toFixed(2)),
                    transferPrice: String(trfPrice.toFixed(2)),
                  } as any)
                  .onConflictDoUpdate({
                    target: domainPricingTable.tld,
                    set: {
                      registrationPrice: String(regPrice.toFixed(2)),
                      renewalPrice: String(renPrice.toFixed(2)),
                    },
                  });

                job.result.extensions++;
              } catch (e: any) {
                errLog(`TLD ${ext}: ${e.message}`);
              }
            }
            log(`Imported ${job.result.extensions} TLD extensions`);
          } catch (e: any) {
            errLog(`TLD pricing fetch failed: ${e.message}`);
          }
        }

        // ── 2. Hosting Plans ──────────────────────────────────────────────
        if (importPlans) {
          setStep("Importing hosting plans", 2);
          try {
            const rawProducts = await fetchAllPages(
              whmcsUrl, identifier, secret, "GetProducts", "products", "product",
            );
            job.total = rawProducts.length;
            log(`Found ${rawProducts.length} products`);

            for (const p of rawProducts) {
              job.current++;
              try {
                const pricing = p.pricing ?? {};
                const monthly = getPrice(pricing, "monthly");
                const quarterly = getPrice(pricing, "quarterly");
                const semiannually = getPrice(pricing, "semiannually");
                const annually = getPrice(pricing, "annually");
                const basePrice = monthly ?? annually ?? quarterly ?? semiannually ?? "0";

                // Features from config options
                const features: string[] = [];
                if (p.diskspace && p.diskspace !== "-1")
                  features.push(`${p.diskspace}MB Disk`);
                if (p.bandwidth && p.bandwidth !== "-1")
                  features.push(`${p.bandwidth}MB Bandwidth`);
                if (p.numemailaccounts && p.numemailaccounts !== "-1")
                  features.push(`${p.numemailaccounts} Email Accounts`);
                if (p.numdatabases && p.numdatabases !== "-1")
                  features.push(`${p.numdatabases} Databases`);
                if (p.numsubdomains && p.numsubdomains !== "-1")
                  features.push(`${p.numsubdomains} Subdomains`);
                if (p.numdomains && p.numdomains !== "0")
                  features.push(`${p.numdomains} Addon Domains`);

                const [plan] = await db
                  .insert(hostingPlansTable)
                  .values({
                    name: p.name ?? "Imported Plan",
                    description: p.description || null,
                    price: basePrice,
                    yearlyPrice: annually ?? null,
                    quarterlyPrice: quarterly ?? null,
                    semiannualPrice: semiannually ?? null,
                    billingCycle: monthly ? "monthly" : "annually",
                    diskSpace: p.diskspace && p.diskspace !== "-1"
                      ? `${p.diskspace} MB`
                      : "Unlimited",
                    bandwidth: p.bandwidth && p.bandwidth !== "-1"
                      ? `${p.bandwidth} MB`
                      : "Unlimited",
                    emailAccounts: parseInt(p.numemailaccounts ?? "10") || 10,
                    databases: parseInt(p.numdatabases ?? "10") || 10,
                    subdomains: parseInt(p.numsubdomains ?? "10") || 10,
                    ftpAccounts: parseInt(p.numftpaccounts ?? "5") || 5,
                    module: p.servertype ?? p.servtype ?? "cpanel",
                    isActive: true,
                    features,
                    groupId: null,
                  } as any)
                  .returning();

                planIdMap.set(String(p.pid), plan.id);
                if (!defaultPlanId) defaultPlanId = plan.id;
                job.result.plans++;
              } catch (e: any) {
                errLog(`Plan [${p.pid}] ${p.name}: ${e.message}`);
              }
            }
            log(`Imported ${job.result.plans} plans`);
          } catch (e: any) {
            errLog(`Plans fetch failed: ${e.message}`);
          }
        }

        // Ensure fallback plan
        if (!defaultPlanId) {
          const [ep] = await db
            .select({ id: hostingPlansTable.id })
            .from(hostingPlansTable)
            .limit(1);
          if (ep) defaultPlanId = ep.id;
        }

        // ── 3. Servers ─────────────────────────────────────────────────────
        if (importServers) {
          setStep("Importing servers", 3);
          try {
            const srvData = await callWhmcs(
              whmcsUrl, identifier, secret, "GetServers", { fetchmodule: "1" },
            );
            const rawServers = srvData.servers?.server
              ? Array.isArray(srvData.servers.server)
                ? srvData.servers.server
                : [srvData.servers.server]
              : [];
            job.total = rawServers.length;
            log(`Found ${rawServers.length} servers`);

            for (const s of rawServers) {
              try {
                const [srv] = await db
                  .insert(serversTable)
                  .values({
                    name: s.name ?? "WHMCS Server",
                    hostname: s.hostname ?? s.ipaddress ?? "server.example.com",
                    ipAddress: s.ipaddress || null,
                    type: "cpanel",
                    apiUsername: s.username || null,
                    apiToken: null,
                    apiPort: parseInt(s.port ?? "2087") || 2087,
                    ns1: s.nameserver1 || null,
                    ns2: s.nameserver2 || null,
                    maxAccounts: parseInt(s.maxaccounts ?? "500") || 500,
                    status: "active",
                    isDefault: false,
                  } as any)
                  .returning();
                serverIdMap.set(String(s.id), srv.id);
                job.result.servers++;
              } catch (e: any) {
                errLog(`Server [${s.id}]: ${e.message}`);
              }
              job.current++;
            }
            log(`Imported ${job.result.servers} servers`);
          } catch (e: any) {
            errLog(`Servers fetch failed: ${e.message}`);
          }
        }

        // ── 4. Clients ─────────────────────────────────────────────────────
        if (importClients) {
          setStep("Importing clients", 4);
          try {
            const rawClients = await fetchAllPages(
              whmcsUrl, identifier, secret, "GetClients", "clients", "client",
            );
            job.total = rawClients.length;
            log(`Found ${rawClients.length} clients`);

            // If password import enabled, fetch details in batches of 5
            const passwordMap = new Map<string, string>(); // whmcs_id → hash
            if (importPasswords) {
              log("Fetching client passwords from WHMCS (this may take a moment)…");
              let fetched = 0;
              await batchRun(rawClients, 5, async (c) => {
                try {
                  const detail = await callWhmcs(
                    whmcsUrl, identifier, secret, "GetClientsDetails",
                    { clientid: c.id, stats: false },
                  );
                  const hash = normalizePasswordHash(detail.client?.password ?? detail.password);
                  if (hash) passwordMap.set(String(c.id), hash);
                  fetched++;
                  if (fetched % 10 === 0) log(`  Passwords fetched: ${fetched}/${rawClients.length}`);
                } catch {}
              });
              log(`Fetched passwords for ${passwordMap.size} clients`);
            }

            for (const c of rawClients) {
              job.current++;
              const email = (c.email ?? "").toLowerCase().trim();
              if (!email) { job.result.skipped++; continue; }

              try {
                const [existing] = await db
                  .select({ id: usersTable.id })
                  .from(usersTable)
                  .where(eq(usersTable.email, email))
                  .limit(1);

                if (existing) {
                  // Map ID and optionally update
                  clientIdMap.set(String(c.id), existing.id);
                  if (!skipExistingClients) {
                    await db.update(usersTable).set({
                      firstName: c.firstname || existing.id,
                      lastName: c.lastname || "",
                      company: c.companyname || null,
                      phone: c.phonenumber || null,
                      status: mapClientStatus(c.status ?? "Active"),
                      creditBalance: String(parseFloat(c.credit ?? "0").toFixed(2)),
                    }).where(eq(usersTable.id, existing.id));
                  }
                  job.result.skipped++;
                  continue;
                }

                // Determine password hash
                const whmcsHash = passwordMap.get(String(c.id));
                const passwordHash = whmcsHash ?? `whmcs_md5:${createHash("md5").update(createHash("md5").update(`temp_${c.id}`).digest("hex")).digest("hex")}`;

                const [user] = await db
                  .insert(usersTable)
                  .values({
                    firstName: c.firstname || "Client",
                    lastName: c.lastname || String(c.id),
                    email,
                    passwordHash,
                    company: c.companyname || null,
                    phone: c.phonenumber || null,
                    role: "client",
                    status: mapClientStatus(c.status ?? "Active"),
                    emailVerified: true,
                    creditBalance: String(parseFloat(c.credit ?? "0").toFixed(2)),
                    createdAt: parseDate(c.datecreated) ?? new Date(),
                  } as any)
                  .returning();

                clientIdMap.set(String(c.id), user.id);
                job.result.clients++;
              } catch (e: any) {
                errLog(`Client [${c.id}] ${c.email}: ${e.message}`);
              }
            }
            log(`Imported ${job.result.clients} new clients, ${job.result.skipped} existing skipped`);
          } catch (e: any) {
            errLog(`Clients fetch failed: ${e.message}`);
          }
        }

        // ── 5. Hosting Services ────────────────────────────────────────────
        if (importServices) {
          setStep("Importing hosting services", 5);
          try {
            const rawServices = await fetchAllPages(
              whmcsUrl, identifier, secret,
              "GetClientsProducts", "products", "product",
            );
            job.total = rawServices.length;
            log(`Found ${rawServices.length} hosting services`);

            for (const s of rawServices) {
              job.current++;
              const clientId =
                clientIdMap.get(String(s.clientid)) ??
                clientIdMap.get(String(s.userid));
              if (!clientId) { job.result.skipped++; continue; }

              const planId = planIdMap.get(String(s.pid)) ?? defaultPlanId;
              if (!planId) { job.result.skipped++; continue; }

              try {
                const serverId = serverIdMap.get(String(s.serverid)) ?? null;
                const cpanelUrl = s.serverip
                  ? `https://${s.serverip}:2083`
                  : null;

                const [svc] = await db
                  .insert(hostingServicesTable)
                  .values({
                    clientId,
                    planId,
                    planName: s.name || s.groupname || "Hosting Service",
                    domain: s.domain || null,
                    username: s.username || null,
                    password: null, // WHMCS passwords are encrypted, can't import
                    serverId,
                    serverIp: s.serverip || s.dedicatedip || null,
                    cpanelUrl,
                    status: mapServiceStatus(s.status ?? "Active"),
                    billingCycle: mapBillingCycle(s.billingcycle ?? "Monthly"),
                    nextDueDate: parseDate(s.nextduedate),
                    startDate: parseDate(s.regdate) ?? new Date(),
                    expiryDate: parseDate(s.nextduedate),
                    diskUsed: s.diskusage ? `${s.diskusage} MB` : "0 MB",
                    bandwidthUsed: s.bwusage ? `${s.bwusage} MB` : "0 GB",
                    autoRenew: true,
                    cancelRequested: false,
                  } as any)
                  .returning();

                serviceIdMap.set(String(s.id), svc.id);
                job.result.services++;
              } catch (e: any) {
                errLog(`Service [${s.id}]: ${e.message}`);
              }
            }
            log(`Imported ${job.result.services} hosting services`);
          } catch (e: any) {
            errLog(`Services fetch failed: ${e.message}`);
          }
        }

        // ── 6. Domains ─────────────────────────────────────────────────────
        if (importDomains) {
          setStep("Importing domains", 6);
          try {
            const rawDomains = await fetchAllPages(
              whmcsUrl, identifier, secret,
              "GetClientsDomains", "domains", "domain",
            );
            job.total = rawDomains.length;
            log(`Found ${rawDomains.length} domains`);

            for (const d of rawDomains) {
              job.current++;
              const clientId = clientIdMap.get(String(d.userid));
              if (!clientId) { job.result.skipped++; continue; }

              const fullDomain = (d.domainname ?? "").toLowerCase().trim();
              if (!fullDomain) { job.result.skipped++; continue; }
              const { name, tld } = splitDomain(fullDomain);

              const ns = [d.nameserver1, d.nameserver2, d.nameserver3, d.nameserver4]
                .filter(Boolean) as string[];

              try {
                await db.insert(domainsTable).values({
                  clientId,
                  name,
                  tld: tld || ".com",
                  registrar: d.registrar || null,
                  registrationDate: parseDate(d.regdate) ?? new Date(),
                  expiryDate: parseDate(d.expirydate),
                  nextDueDate: parseDate(d.nextduedate),
                  status: mapDomainStatus(d.status ?? "Active"),
                  lockStatus: d.idprotection === "1" ? "locked" : "locked",
                  autoRenew: d.autorenew === "1" || d.autorenew === true,
                  nameservers: ns,
                } as any);
                job.result.domains++;
              } catch (e: any) {
                errLog(`Domain [${d.id}] ${d.domainname}: ${e.message}`);
              }
            }
            log(`Imported ${job.result.domains} domains`);
          } catch (e: any) {
            errLog(`Domains fetch failed: ${e.message}`);
          }
        }

        // ── 7. Orders ──────────────────────────────────────────────────────
        if (importOrders) {
          setStep("Importing orders", 7);
          try {
            const rawOrders = await fetchAllPages(
              whmcsUrl, identifier, secret, "GetOrders", "orders", "order",
            );
            job.total = rawOrders.length;
            log(`Found ${rawOrders.length} orders`);

            for (const o of rawOrders) {
              job.current++;
              const clientId = clientIdMap.get(String(o.userid));
              if (!clientId) { job.result.skipped++; continue; }

              // Determine order type from line items
              const lineItems = o.lineItems?.lineItem
                ? Array.isArray(o.lineItems.lineItem)
                  ? o.lineItems.lineItem
                  : [o.lineItems.lineItem]
                : [];
              const firstItem = lineItems[0];
              let orderType: "hosting" | "domain" | "renewal" = "hosting";
              if (firstItem?.type === "domain") orderType = "domain";
              else if (firstItem?.type === "domainrenew") orderType = "renewal";

              // Find corresponding plan
              const planId = firstItem?.relid
                ? planIdMap.get(String(firstItem.relid))
                : undefined;
              const svcId = firstItem?.relid
                ? serviceIdMap.get(String(firstItem.relid))
                : undefined;

              try {
                await db.insert(ordersTable).values({
                  clientId,
                  type: orderType,
                  itemId: svcId ?? planId ?? null,
                  itemName: firstItem?.product ?? o.invoiceid?.toString() ?? "Order",
                  domain: firstItem?.domain ?? o.domain ?? null,
                  amount: String(parseFloat(o.amount ?? "0").toFixed(2)),
                  billingCycle: mapBillingCycle(firstItem?.billingcycle ?? "Monthly"),
                  dueDate: parseDate(o.date) ?? new Date(),
                  paymentStatus:
                    o.paymentstatus === "Paid" ? "paid" : "unpaid",
                  status: mapOrderStatus(o.status ?? "Active"),
                  notes: o.notes || null,
                  createdAt: parseDate(o.date) ?? new Date(),
                } as any);
                job.result.orders++;
              } catch (e: any) {
                errLog(`Order [${o.id}]: ${e.message}`);
              }
            }
            log(`Imported ${job.result.orders} orders`);
          } catch (e: any) {
            errLog(`Orders fetch failed: ${e.message}`);
          }
        }

        // ── 8. Invoices ────────────────────────────────────────────────────
        if (importInvoices) {
          setStep("Importing invoices", 8);
          try {
            const rawInvoices = await fetchAllPages(
              whmcsUrl, identifier, secret, "GetInvoices", "invoices", "invoice",
            );
            job.total = rawInvoices.length;
            log(`Found ${rawInvoices.length} invoices`);

            // Get max invoice number to continue sequence
            const [maxRow] = (await db.execute(
              sql`SELECT MAX(CAST(REGEXP_REPLACE(invoice_number, '[^0-9]', '', 'g') AS INTEGER)) AS n FROM invoices WHERE invoice_number ~ '^[A-Z]*[0-9]+$'`,
            )) as any[];
            let nextNum = (maxRow?.n ?? 0) + 1;

            for (const inv of rawInvoices) {
              job.current++;
              const clientId = clientIdMap.get(String(inv.userid));
              if (!clientId) { job.result.skipped++; continue; }

              const dueDate = parseDate(inv.duedate) ?? new Date();
              const paidDate = parseDate(inv.datepaid);
              const amount = parseFloat(inv.subtotal ?? "0") || 0;
              const tax = parseFloat(inv.tax ?? "0") || 0;
              const total = parseFloat(inv.total ?? "0") || 0;
              const status = mapInvoiceStatus(inv.status ?? "Unpaid");
              const invNum = `INV${String(nextNum++).padStart(6, "0")}`;

              // Build items array — use WHMCS items if available
              const whmcsItems = inv.items?.item
                ? Array.isArray(inv.items.item) ? inv.items.item : [inv.items.item]
                : [];
              const items =
                whmcsItems.length > 0
                  ? whmcsItems.map((it: any) => ({
                      description: it.description ?? "Service",
                      amount: parseFloat(it.amount ?? "0") || 0,
                    }))
                  : [{ description: `Imported from WHMCS #${inv.id}`, amount: total }];

              try {
                const [inserted] = await db
                  .insert(invoicesTable)
                  .values({
                    invoiceNumber: invNum,
                    clientId,
                    amount: String(amount.toFixed(2)),
                    tax: String(tax.toFixed(2)),
                    total: String(total.toFixed(2)),
                    status,
                    dueDate,
                    paidDate: status === "paid" ? (paidDate ?? new Date()) : null,
                    items: JSON.stringify(items),
                    paymentNotes: inv.paymentmethod
                      ? `Paid via ${inv.paymentmethod}`
                      : null,
                    invoiceType: "hosting",
                    createdAt: parseDate(inv.date) ?? new Date(),
                  } as any)
                  .returning();

                invoiceIdMap.set(String(inv.id), inserted.id);
                job.result.invoices++;
              } catch (e: any) {
                errLog(`Invoice [${inv.id}]: ${e.message}`);
              }
            }
            log(`Imported ${job.result.invoices} invoices`);
          } catch (e: any) {
            errLog(`Invoices fetch failed: ${e.message}`);
          }
        }

        // ── Done ─────────────────────────────────────────────────────────
        job.status = "completed";
        job.step = "Complete";
        job.completedAt = new Date().toISOString();
        log("✅ Migration complete!");
        log(
          `Summary: ${job.result.extensions} TLDs | ${job.result.plans} plans | ` +
          `${job.result.servers} servers | ${job.result.clients} clients | ` +
          `${job.result.services} services | ${job.result.domains} domains | ` +
          `${job.result.orders} orders | ${job.result.invoices} invoices | ` +
          `${job.result.errors} errors`,
        );
      } catch (e: any) {
        job.status = "failed";
        job.step = "Failed";
        job.logs.push(`[FATAL] ${e.message}`);
      }
    })();

    res.json({ jobId, message: "Import started" });
  },
);

// ── Poll job status ───────────────────────────────────────────────────────────
router.get(
  "/admin/whmcs/import/:jobId/status",
  authenticate,
  requireAdmin,
  async (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    res.json({
      jobId: job.jobId,
      status: job.status,
      step: job.step,
      stepIndex: job.stepIndex,
      totalSteps: job.totalSteps,
      current: job.current,
      total: job.total,
      logs: job.logs.slice(-100),
      result: job.result,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  },
);

// ── Recent jobs ───────────────────────────────────────────────────────────────
router.get("/admin/whmcs/jobs", authenticate, requireAdmin, async (_req, res) => {
  const list = Array.from(jobs.values())
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 5)
    .map((j) => ({
      jobId: j.jobId,
      status: j.status,
      step: j.step,
      result: j.result,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
    }));
  res.json(list);
});

export default router;
