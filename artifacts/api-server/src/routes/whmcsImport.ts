import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, hostingPlansTable, hostingServicesTable,
  domainsTable, invoicesTable, ordersTable, serversTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import bcrypt from "bcryptjs";

const router = Router();

// ── In-memory job tracker ─────────────────────────────────────────────────────
interface ImportJob {
  jobId: string;
  status: "running" | "completed" | "failed";
  step: string;
  current: number;
  total: number;
  logs: string[];
  result: {
    clients: number; plans: number; services: number;
    domains: number; invoices: number; servers: number;
    skipped: number; errors: number;
  };
  startedAt: string;
  completedAt?: string;
}

const jobs = new Map<string, ImportJob>();

// ── WHMCS API caller ──────────────────────────────────────────────────────────
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
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`WHMCS HTTP error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (data.result === "error") throw new Error(`WHMCS API error: ${data.message}`);
  return data;
}

// Paginated WHMCS fetcher — gets ALL records across pages
async function fetchAllWhmcs(
  baseUrl: string, identifier: string, secret: string,
  action: string, dataKey: string, subKey: string,
  extraParams: Record<string, any> = {},
): Promise<any[]> {
  const all: any[] = [];
  let start = 0;
  const limit = 250;

  while (true) {
    const data = await callWhmcs(baseUrl, identifier, secret, action, {
      limitstart: start, limitnum: limit, ...extraParams,
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

// ── Mapping helpers ───────────────────────────────────────────────────────────
function mapClientStatus(s: string): "active" | "inactive" | "suspended" {
  if (s === "Active") return "active";
  if (s === "Inactive") return "inactive";
  return "suspended";
}

function mapServiceStatus(s: string): "active" | "suspended" | "terminated" | "cancelled" | "pending" {
  const map: Record<string, any> = {
    Active: "active", Suspended: "suspended",
    Terminated: "terminated", Cancelled: "cancelled", Pending: "pending",
  };
  return map[s] ?? "pending";
}

function mapDomainStatus(s: string): "active" | "expired" | "pending" | "cancelled" | "transferred_away" | "redemption" {
  const map: Record<string, any> = {
    Active: "active", Expired: "expired", Pending: "pending",
    Cancelled: "cancelled", Redemption: "redemption", "Transferred Away": "transferred_away",
  };
  return map[s] ?? "pending";
}

function mapInvoiceStatus(s: string): "paid" | "unpaid" | "cancelled" | "refunded" | "overdue" {
  const map: Record<string, any> = {
    Paid: "paid", Unpaid: "unpaid", Cancelled: "cancelled",
    Refunded: "refunded", Collections: "overdue",
  };
  return map[s] ?? "unpaid";
}

function mapBillingCycle(s: string): string {
  const map: Record<string, string> = {
    "Monthly": "monthly", "Quarterly": "quarterly",
    "Semi-Annually": "semi-annually", "Annually": "annually",
    "Biennially": "annually", "Triennially": "annually",
    "Free Account": "monthly", "One Time": "monthly",
  };
  return map[s] ?? "monthly";
}

function parseDate(d: string | null | undefined): Date | null {
  if (!d || d === "0000-00-00" || d === "") return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function splitDomain(full: string): { name: string; tld: string } {
  const parts = full.toLowerCase().split(".");
  if (parts.length >= 3 && parts[parts.length - 2].length <= 3) {
    return { name: parts.slice(0, -2).join("."), tld: "." + parts.slice(-2).join(".") };
  }
  if (parts.length >= 2) {
    return { name: parts.slice(0, -1).join("."), tld: "." + parts[parts.length - 1] };
  }
  return { name: full, tld: "" };
}

// ── Test WHMCS connection ─────────────────────────────────────────────────────
router.post("/admin/whmcs/test", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { whmcsUrl, identifier, secret } = req.body;
    if (!whmcsUrl || !identifier || !secret) {
      res.status(400).json({ error: "whmcsUrl, identifier, and secret are required" });
      return;
    }
    const data = await callWhmcs(whmcsUrl, identifier, secret, "GetClients", { limitnum: 1 });
    res.json({
      success: true,
      message: `Connection successful! Found ${data.totalresults ?? 0} clients in WHMCS.`,
      totalClients: parseInt(data.totalresults ?? "0"),
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── Preview — count available records ─────────────────────────────────────────
router.post("/admin/whmcs/preview", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { whmcsUrl, identifier, secret } = req.body;
    if (!whmcsUrl || !identifier || !secret) {
      res.status(400).json({ error: "Missing credentials" });
      return;
    }

    const [clientsData, productsData, servicesData, domainsData, invoicesData] = await Promise.all([
      callWhmcs(whmcsUrl, identifier, secret, "GetClients", { limitnum: 1 }),
      callWhmcs(whmcsUrl, identifier, secret, "GetProducts", { limitnum: 1 }),
      callWhmcs(whmcsUrl, identifier, secret, "GetClientsProducts", { limitnum: 1 }),
      callWhmcs(whmcsUrl, identifier, secret, "GetClientsDomains", { limitnum: 1 }),
      callWhmcs(whmcsUrl, identifier, secret, "GetInvoices", { limitnum: 1 }),
    ]);

    res.json({
      clients:  parseInt(clientsData.totalresults  ?? "0"),
      plans:    parseInt(productsData.totalresults ?? productsData.products?.product ? "unknown" : "0"),
      services: parseInt(servicesData.totalresults ?? "0"),
      domains:  parseInt(domainsData.totalresults  ?? "0"),
      invoices: parseInt(invoicesData.totalresults ?? "0"),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── Start import job ──────────────────────────────────────────────────────────
router.post("/admin/whmcs/import", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const { whmcsUrl, identifier, secret, options = {} } = req.body;
  if (!whmcsUrl || !identifier || !secret) {
    res.status(400).json({ error: "Missing credentials" });
    return;
  }

  const jobId = crypto.randomUUID();
  const job: ImportJob = {
    jobId, status: "running", step: "Starting…", current: 0, total: 0,
    logs: ["[INFO] WHMCS import started"], startedAt: new Date().toISOString(),
    result: { clients: 0, plans: 0, services: 0, domains: 0, invoices: 0, servers: 0, skipped: 0, errors: 0 },
  };
  jobs.set(jobId, job);

  const log = (msg: string) => { job.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`); };
  const err = (msg: string) => { job.logs.push(`[ERR] ${msg}`); job.result.errors++; };

  // Run async
  (async () => {
    try {
      const skipExistingClients: boolean = options.skipExistingClients !== false;
      const importPlans:    boolean = options.importPlans    !== false;
      const importClients:  boolean = options.importClients  !== false;
      const importServices: boolean = options.importServices !== false;
      const importDomains:  boolean = options.importDomains  !== false;
      const importInvoices: boolean = options.importInvoices !== false;

      // ID mapping: WHMCS ID → our UUID
      const clientIdMap   = new Map<string, string>(); // whmcs_id → our_id
      const planIdMap     = new Map<string, string>(); // whmcs_pid → our_id
      const serverIdMap   = new Map<string, string>(); // whmcs_server_id → our_id
      let   defaultPlanId = "";

      // ── 1. Import Hosting Plans ──────────────────────────────────────────
      if (importPlans) {
        job.step = "Importing hosting plans…";
        log("Fetching WHMCS products/plans…");
        try {
          const rawProducts = await fetchAllWhmcs(whmcsUrl, identifier, secret, "GetProducts", "products", "product");
          job.total = rawProducts.length;
          log(`Found ${rawProducts.length} products`);

          for (const p of rawProducts) {
            job.current++;
            try {
              const pricing = p.pricing ?? {};
              const currency = Object.keys(pricing)[0] ?? "USD";
              const pricingCur = pricing[currency] ?? {};
              const monthlyPrice = parseFloat(pricingCur.monthly ?? pricingCur.annually ?? "0") || 0;
              const yearlyPrice  = parseFloat(pricingCur.annually ?? "0") || null;

              const [plan] = await db.insert(hostingPlansTable).values({
                name: p.name ?? "Imported Plan",
                description: p.description ?? null,
                price: String(monthlyPrice.toFixed(2)),
                yearlyPrice: yearlyPrice ? String(yearlyPrice.toFixed(2)) : null,
                billingCycle: "monthly",
                diskSpace: p.diskspace ? String(p.diskspace) + " MB" : "Unlimited",
                bandwidth: p.bandwidth ? String(p.bandwidth) + " MB" : "Unlimited",
                emailAccounts: parseInt(p.numemailaccounts ?? p.numaccounts ?? "10") || 10,
                databases: parseInt(p.numdatabases ?? "5") || 5,
                subdomains: parseInt(p.numsubdomains ?? "10") || 10,
                ftpAccounts: parseInt(p.numftpaccounts ?? "5") || 5,
                module: p.servertype ?? p.servtype ?? "none",
                isActive: true,
                features: [],
              } as any).returning();

              planIdMap.set(String(p.pid), plan.id);
              if (!defaultPlanId) defaultPlanId = plan.id;
              job.result.plans++;
            } catch (e: any) {
              err(`Plan import failed [pid=${p.pid}]: ${e.message}`);
            }
          }
          log(`Imported ${job.result.plans} plans (${job.result.errors} errors)`);
        } catch (e: any) {
          err(`Failed to fetch plans: ${e.message}`);
        }
      }

      // Ensure we have a fallback plan ID
      if (!defaultPlanId) {
        const [existingPlan] = await db.select({ id: hostingPlansTable.id }).from(hostingPlansTable).limit(1);
        if (existingPlan) defaultPlanId = existingPlan.id;
      }

      // ── 2. Import Servers ─────────────────────────────────────────────────
      job.step = "Importing servers…";
      log("Fetching WHMCS servers…");
      try {
        const serversData = await callWhmcs(whmcsUrl, identifier, secret, "GetServers", { fetchmodule: "1" });
        const rawServers = serversData.servers?.server
          ? (Array.isArray(serversData.servers.server) ? serversData.servers.server : [serversData.servers.server])
          : [];

        for (const s of rawServers) {
          try {
            const [srv] = await db.insert(serversTable).values({
              name: s.name ?? "WHMCS Server",
              hostname: s.hostname ?? s.ipaddress ?? "server.example.com",
              ipAddress: s.ipaddress ?? null,
              type: "cpanel",
              apiUsername: s.username ?? null,
              apiToken: null,
              apiPort: parseInt(s.port ?? "2087"),
              ns1: s.nameserver1 ?? null,
              ns2: s.nameserver2 ?? null,
              maxAccounts: parseInt(s.maxaccounts ?? "500") || 500,
              status: "active",
              isDefault: false,
            } as any).returning();

            serverIdMap.set(String(s.id), srv.id);
            job.result.servers++;
          } catch (e: any) {
            err(`Server import failed [id=${s.id}]: ${e.message}`);
          }
        }
        log(`Imported ${job.result.servers} servers`);
      } catch (e: any) {
        err(`Failed to fetch servers: ${e.message}`);
      }

      // ── 3. Import Clients ─────────────────────────────────────────────────
      if (importClients) {
        job.step = "Importing clients…";
        log("Fetching WHMCS clients…");
        try {
          const rawClients = await fetchAllWhmcs(whmcsUrl, identifier, secret, "GetClients", "clients", "client");
          job.total = rawClients.length;
          job.current = 0;
          log(`Found ${rawClients.length} clients`);

          for (const c of rawClients) {
            job.current++;
            try {
              const email = (c.email ?? "").toLowerCase().trim();
              if (!email) { job.result.skipped++; continue; }

              // Check if client already exists
              const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
                .where(eq(usersTable.email, email)).limit(1);

              if (existing) {
                if (skipExistingClients) {
                  clientIdMap.set(String(c.id), existing.id);
                  job.result.skipped++;
                  continue;
                }
                // Update existing
                await db.update(usersTable).set({
                  firstName: c.firstname ?? "Client",
                  lastName:  c.lastname  ?? String(c.id),
                  company:   c.companyname || null,
                  phone:     c.phonenumber || null,
                  status:    mapClientStatus(c.status ?? "Active"),
                  creditBalance: String(parseFloat(c.credit ?? "0").toFixed(2)),
                }).where(eq(usersTable.id, existing.id));
                clientIdMap.set(String(c.id), existing.id);
                job.result.skipped++;
                continue;
              }

              // Create new user with temp password
              const tempPassword = await bcrypt.hash("WhmcsMigrated@" + c.id, 10);
              const [user] = await db.insert(usersTable).values({
                firstName: c.firstname ?? "Client",
                lastName:  c.lastname  ?? String(c.id),
                email,
                passwordHash: tempPassword,
                company:   c.companyname || null,
                phone:     c.phonenumber || null,
                role:      "client",
                status:    mapClientStatus(c.status ?? "Active"),
                emailVerified: true,
                creditBalance: String(parseFloat(c.credit ?? "0").toFixed(2)),
                createdAt: parseDate(c.datecreated) ?? new Date(),
              } as any).returning();

              clientIdMap.set(String(c.id), user.id);
              job.result.clients++;
            } catch (e: any) {
              err(`Client import failed [id=${c.id}]: ${e.message}`);
            }
          }
          log(`Imported ${job.result.clients} clients (${job.result.skipped} skipped, ${job.result.errors} errors)`);
        } catch (e: any) {
          err(`Failed to fetch clients: ${e.message}`);
        }
      }

      // ── 4. Import Hosting Services ─────────────────────────────────────────
      if (importServices) {
        job.step = "Importing hosting services…";
        log("Fetching WHMCS hosting services…");
        try {
          const rawServices = await fetchAllWhmcs(
            whmcsUrl, identifier, secret, "GetClientsProducts", "products", "product",
          );
          job.total = rawServices.length;
          job.current = 0;
          log(`Found ${rawServices.length} hosting services`);

          for (const s of rawServices) {
            job.current++;
            try {
              const clientId = clientIdMap.get(String(s.clientid)) ?? clientIdMap.get(String(s.userid));
              if (!clientId) { job.result.skipped++; continue; }

              const planId = planIdMap.get(String(s.pid)) ?? defaultPlanId;
              if (!planId) { job.result.skipped++; continue; }

              const serverId = serverIdMap.get(String(s.serverid)) ?? null;
              const nextDue = parseDate(s.nextduedate);
              const startDate = parseDate(s.regdate);

              await db.insert(hostingServicesTable).values({
                clientId,
                planId,
                planName: s.name ?? s.groupname ?? "Hosting",
                domain: s.domain || null,
                username: s.username || null,
                password: null,
                serverId,
                serverIp: s.serverip || s.dedicatedip || null,
                status: mapServiceStatus(s.status ?? "Active"),
                billingCycle: mapBillingCycle(s.billingcycle ?? "Monthly"),
                nextDueDate: nextDue,
                startDate: startDate ?? new Date(),
                diskUsed: s.diskusage ? `${s.diskusage} MB` : "0 MB",
                bandwidthUsed: s.bwusage ? `${s.bwusage} MB` : "0 GB",
                autoRenew: true,
              } as any).returning();

              job.result.services++;
            } catch (e: any) {
              err(`Service import failed [id=${s.id}]: ${e.message}`);
            }
          }
          log(`Imported ${job.result.services} hosting services`);
        } catch (e: any) {
          err(`Failed to fetch services: ${e.message}`);
        }
      }

      // ── 5. Import Domains ─────────────────────────────────────────────────
      if (importDomains) {
        job.step = "Importing domains…";
        log("Fetching WHMCS domains…");
        try {
          const rawDomains = await fetchAllWhmcs(
            whmcsUrl, identifier, secret, "GetClientsDomains", "domains", "domain",
          );
          job.total = rawDomains.length;
          job.current = 0;
          log(`Found ${rawDomains.length} domains`);

          for (const d of rawDomains) {
            job.current++;
            try {
              const clientId = clientIdMap.get(String(d.userid));
              if (!clientId) { job.result.skipped++; continue; }

              const fullDomain = (d.domainname ?? "").toLowerCase().trim();
              if (!fullDomain) { job.result.skipped++; continue; }
              const { name, tld } = splitDomain(fullDomain);

              const ns = [d.nameserver1, d.nameserver2, d.nameserver3, d.nameserver4]
                .filter(Boolean) as string[];

              await db.insert(domainsTable).values({
                clientId,
                name,
                tld: tld || ".com",
                registrar: d.registrar || null,
                registrationDate: parseDate(d.regdate) ?? new Date(),
                expiryDate: parseDate(d.expirydate),
                nextDueDate: parseDate(d.nextduedate),
                status: mapDomainStatus(d.status ?? "Active"),
                lockStatus: "locked",
                autoRenew: d.autorenew === "1" || d.autorenew === true,
                nameservers: ns,
              } as any).returning();

              job.result.domains++;
            } catch (e: any) {
              err(`Domain import failed [id=${d.id}, domain=${d.domainname}]: ${e.message}`);
            }
          }
          log(`Imported ${job.result.domains} domains`);
        } catch (e: any) {
          err(`Failed to fetch domains: ${e.message}`);
        }
      }

      // ── 6. Import Invoices ─────────────────────────────────────────────────
      if (importInvoices) {
        job.step = "Importing invoices…";
        log("Fetching WHMCS invoices…");
        try {
          const rawInvoices = await fetchAllWhmcs(
            whmcsUrl, identifier, secret, "GetInvoices", "invoices", "invoice",
          );
          job.total = rawInvoices.length;
          job.current = 0;
          log(`Found ${rawInvoices.length} invoices`);

          // Get current max invoice number to avoid duplicates
          const [maxRow] = await db.execute(
            sql`SELECT MAX(CAST(REGEXP_REPLACE(invoice_number, '[^0-9]', '', 'g') AS INTEGER)) as max_num FROM invoices WHERE invoice_number ~ '^[A-Z]*[0-9]+$'`,
          ) as any;
          let nextInvoiceNum = (maxRow?.max_num ?? 0) + 1;

          for (const inv of rawInvoices) {
            job.current++;
            try {
              const clientId = clientIdMap.get(String(inv.userid));
              if (!clientId) { job.result.skipped++; continue; }

              const dueDate  = parseDate(inv.duedate)  ?? new Date();
              const paidDate = parseDate(inv.datepaid);
              const amount   = parseFloat(inv.subtotal ?? inv.total ?? "0") || 0;
              const tax      = parseFloat(inv.tax ?? "0") || 0;
              const total    = parseFloat(inv.total ?? "0") || 0;
              const status   = mapInvoiceStatus(inv.status ?? "Unpaid");
              const invNum   = `INV${String(nextInvoiceNum++).padStart(6, "0")}`;

              await db.insert(invoicesTable).values({
                invoiceNumber: invNum,
                clientId,
                amount: String(amount.toFixed(2)),
                tax: String(tax.toFixed(2)),
                total: String(total.toFixed(2)),
                status,
                dueDate,
                paidDate: status === "paid" ? (paidDate ?? new Date()) : null,
                items: JSON.stringify([{
                  description: `Imported from WHMCS #${inv.id}`,
                  amount: total,
                }]),
                paymentNotes: inv.paymentmethod ? `Payment: ${inv.paymentmethod}` : null,
                createdAt: parseDate(inv.date) ?? new Date(),
              } as any).returning();

              job.result.invoices++;
            } catch (e: any) {
              err(`Invoice import failed [id=${inv.id}]: ${e.message}`);
            }
          }
          log(`Imported ${job.result.invoices} invoices`);
        } catch (e: any) {
          err(`Failed to fetch invoices: ${e.message}`);
        }
      }

      // ── Done ──────────────────────────────────────────────────────────────
      job.status = "completed";
      job.step = "Complete";
      job.completedAt = new Date().toISOString();
      log("✅ WHMCS import completed successfully!");
      log(`Summary: ${job.result.clients} clients | ${job.result.plans} plans | ${job.result.services} services | ${job.result.domains} domains | ${job.result.invoices} invoices`);
    } catch (e: any) {
      job.status = "failed";
      job.step = "Failed";
      job.logs.push(`[FATAL] ${e.message}`);
    }
  })();

  res.json({ jobId, message: "Import started" });
});

// ── Poll job status ───────────────────────────────────────────────────────────
router.get("/admin/whmcs/import/:jobId/status", authenticate, requireAdmin, async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json({
    jobId: job.jobId,
    status: job.status,
    step: job.step,
    current: job.current,
    total: job.total,
    logs: job.logs.slice(-80), // last 80 log lines
    result: job.result,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  });
});

// ── List recent jobs ──────────────────────────────────────────────────────────
router.get("/admin/whmcs/jobs", authenticate, requireAdmin, async (_req, res) => {
  const list = Array.from(jobs.values())
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 5)
    .map(j => ({
      jobId: j.jobId, status: j.status, step: j.step,
      result: j.result, startedAt: j.startedAt, completedAt: j.completedAt,
    }));
  res.json(list);
});

export default router;
