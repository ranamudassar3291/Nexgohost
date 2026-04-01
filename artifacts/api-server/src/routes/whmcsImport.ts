/**
 * WHMCS → Noehost Complete Migration
 * Migrates ALL data exactly as-is: TLD extensions, hosting plans, servers,
 * clients (with original passwords), hosting services, domains, orders,
 * invoices, and tickets — with original numbers, dates, and statuses preserved.
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
  ticketsTable,
  ticketMessagesTable,
  productGroupsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { createHash } from "crypto";

const router = Router();

// ── Job tracker ───────────────────────────────────────────────────────────────
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
    extensions: number; plans: number; servers: number; clients: number;
    services: number; domains: number; orders: number; invoices: number;
    tickets: number; skipped: number; errors: number;
  };
  startedAt: string;
  completedAt?: string;
}

const jobs = new Map<string, ImportJob>();

// ── WHMCS API ─────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function whmcsCall(
  baseUrl: string, id: string, secret: string,
  action: string, params: Record<string, any> = {},
  retries = 4,
): Promise<any> {
  const url = baseUrl.replace(/\/$/, "") + "/includes/api.php";
  const body = new URLSearchParams({
    identifier: id, secret, action, responsetype: "json",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 429 || res.status === 503) {
      if (attempt < retries) { await sleep(3000 * (attempt + 1)); continue; }
      throw new Error(`WHMCS HTTP ${res.status}`);
    }
    if (!res.ok) throw new Error(`WHMCS HTTP ${res.status}`);
    const data = await res.json();
    if (data.result === "error") throw new Error(`WHMCS: ${data.message}`);
    return data;
  }
}

async function whmcsPages(
  baseUrl: string, id: string, secret: string,
  action: string, dataKey: string, subKey: string,
  extra: Record<string, any> = {},
): Promise<any[]> {
  const all: any[] = [];
  let start = 0;
  while (true) {
    const data = await whmcsCall(baseUrl, id, secret, action, {
      limitstart: start, limitnum: 1000, ...extra,
    });
    const arr = toArray(data[dataKey]?.[subKey]);
    all.push(...arr);
    const total = parseInt(data.totalresults ?? "0");
    start += arr.length;
    if (start >= total || arr.length === 0) break;
    await sleep(300);
  }
  return all;
}

function toArray(v: any): any[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

async function batchRun<T>(
  items: T[], concurrency: number, fn: (item: T, i: number) => Promise<void>,
): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx], idx).catch(() => {}); }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// ── Mappers ───────────────────────────────────────────────────────────────────
function clientStatus(s: string): "active" | "suspended" {
  return s === "Active" ? "active" : "suspended";
}

function serviceStatus(s: string): "active" | "suspended" | "terminated" | "pending" {
  return ({ Active:"active", Suspended:"suspended", Terminated:"terminated",
    Cancelled:"terminated", Pending:"pending" } as any)[s] ?? "pending";
}

function domainStatus(s: string): "active" | "expired" | "pending" | "cancelled" | "transferred" | "suspended" {
  return ({ Active:"active", Expired:"expired", Pending:"pending",
    Cancelled:"cancelled", Redemption:"expired", "Transferred Away":"transferred",
    Suspended:"suspended" } as any)[s] ?? "pending";
}

function invoiceStatus(s: string): "paid" | "unpaid" | "cancelled" | "refunded" | "overdue" | "collections" {
  return ({ Paid:"paid", Unpaid:"unpaid", Cancelled:"cancelled",
    Refunded:"refunded", Collections:"collections",
    "Payment Pending":"unpaid" } as any)[s] ?? "unpaid";
}

function orderStatus(s: string): "approved" | "pending" | "cancelled" | "fraud" {
  return ({ Active:"approved", Pending:"pending", Cancelled:"cancelled",
    Fraud:"fraud", Failed:"cancelled", Refunded:"cancelled" } as any)[s] ?? "pending";
}

function ticketStatus(s: string): "open" | "closed" | "pending" | "answered" {
  return ({ Open:"open", Closed:"closed", Answered:"answered",
    "Customer-Reply":"open", "On Hold":"pending",
    "In Progress":"open" } as any)[s] ?? "open";
}

function ticketPriority(s: string): "low" | "medium" | "high" | "urgent" {
  return ({ Low:"low", Medium:"medium", High:"high",
    Urgent:"urgent", Critical:"urgent" } as any)[s] ?? "medium";
}

function billingCycle(s: string): "monthly" | "yearly" {
  const t = (s ?? "").toLowerCase();
  if (t.includes("annual") || t.includes("yearly") || t.includes("year") ||
      t.includes("bienni") || t.includes("trienni")) return "yearly";
  return "monthly";
}

function parseDate(d: string | null | undefined): Date | null {
  if (!d || d === "0000-00-00" || d === "" || d === "0000-00-00 00:00:00") return null;
  const p = new Date(d);
  return isNaN(p.getTime()) ? null : p;
}

function splitDomain(full: string): { name: string; tld: string } {
  const parts = full.toLowerCase().split(".");
  if (parts.length >= 3 && ["co","com","net","org","gov","edu","ac"].includes(parts[parts.length - 2])) {
    return { name: parts.slice(0, -2).join("."), tld: "." + parts.slice(-2).join(".") };
  }
  if (parts.length >= 2) return { name: parts.slice(0, -1).join("."), tld: "." + parts[parts.length - 1] };
  return { name: full, tld: "" };
}

function normalizeHash(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const h = hash.trim();
  if (!h) return null;
  if (h.startsWith("$2y$")) return h.replace("$2y$", "$2b$");
  if (h.startsWith("$2a$") || h.startsWith("$2b$")) return h;
  if (/^[a-f0-9]{32}$/i.test(h)) return `whmcs_md5:${h}`;
  return null; // unknown — don't store garbage
}

function getPrice(pricing: any, cycle: string): string | null {
  const cur = Object.keys(pricing ?? {})[0] ?? "USD";
  const p = pricing?.[cur]?.[cycle];
  if (!p || p === "-1" || parseFloat(p) <= 0) return null;
  return parseFloat(p).toFixed(2);
}

// ── Build invoice number from WHMCS data ──────────────────────────────────────
function buildInvoiceNumber(inv: any): string {
  const num = (inv.invoicenum ?? "").toString().trim();
  if (num && num !== "0") return num;
  return `INV${String(inv.id).padStart(5, "0")}`;
}

// ── Outbound IP (so admin knows what to whitelist in WHMCS) ──────────────────
router.get("/admin/whmcs/my-ip", authenticate, requireAdmin, async (_req, res) => {
  try {
    const r = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    res.json({ ip: d.ip });
  } catch {
    try {
      const r2 = await fetch("https://ifconfig.me/ip", { signal: AbortSignal.timeout(8000) });
      const ip = (await r2.text()).trim();
      res.json({ ip });
    } catch {
      res.json({ ip: "unknown" });
    }
  }
});

// ── Test ──────────────────────────────────────────────────────────────────────
router.post("/admin/whmcs/test", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { whmcsUrl, identifier, secret } = req.body;
    if (!whmcsUrl || !identifier || !secret) { res.status(400).json({ error: "Missing fields" }); return; }
    const data = await whmcsCall(whmcsUrl, identifier, secret, "GetClients", { limitnum: 1 });
    res.json({ success: true, message: `Connected! Found ${data.totalresults ?? 0} clients in WHMCS.`, totalClients: parseInt(data.totalresults ?? "0") });
  } catch (err: any) { res.status(400).json({ success: false, error: err.message }); }
});

// ── Preview ───────────────────────────────────────────────────────────────────
router.post("/admin/whmcs/preview", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { whmcsUrl, identifier, secret } = req.body;
    if (!whmcsUrl || !identifier || !secret) { res.status(400).json({ error: "Missing credentials" }); return; }
    const [c, p, s, d, inv, o] = await Promise.all([
      whmcsCall(whmcsUrl, identifier, secret, "GetClients", { limitnum: 1 }),
      whmcsCall(whmcsUrl, identifier, secret, "GetProducts", { limitnum: 1 }),
      whmcsCall(whmcsUrl, identifier, secret, "GetClientsProducts", { limitnum: 1 }),
      whmcsCall(whmcsUrl, identifier, secret, "GetClientsDomains", { limitnum: 1 }),
      whmcsCall(whmcsUrl, identifier, secret, "GetInvoices", { limitnum: 1 }),
      whmcsCall(whmcsUrl, identifier, secret, "GetOrders", { limitnum: 1 }),
    ]);
    let ext = 0;
    try { const tld = await whmcsCall(whmcsUrl, identifier, secret, "GetTldPricing"); ext = Object.keys(tld.pricing ?? {}).length; } catch {}

    // Tickets: try multiple approaches — WHMCS may restrict by dept or status
    let ticketCount = 0;
    for (const params of [
      { limitnum: 1, ignore_dept_assignments: "1" },
      { limitnum: 1, status: "All" },
      { limitnum: 1 },
    ]) {
      try {
        const t = await whmcsCall(whmcsUrl, identifier, secret, "GetTickets", params);
        const n = parseInt(t.totalresults ?? t.numreturned ?? "0");
        if (n > ticketCount) ticketCount = n;
        if (ticketCount > 0) break;
      } catch {}
    }
    // Also try counting each status separately as fallback
    if (ticketCount === 0) {
      for (const status of ["Open", "Answered", "Customer-Reply", "On Hold", "In Progress", "Closed"]) {
        try {
          const t = await whmcsCall(whmcsUrl, identifier, secret, "GetTickets", { limitnum: 1, status, ignore_dept_assignments: "1" });
          ticketCount += parseInt(t.totalresults ?? "0");
        } catch {}
      }
    }

    res.json({
      clients: parseInt(c.totalresults ?? "0"),
      plans: parseInt(p.totalresults ?? "0"),
      services: parseInt(s.totalresults ?? "0"),
      domains: parseInt(d.totalresults ?? "0"),
      invoices: parseInt(inv.totalresults ?? "0"),
      orders: parseInt(o.totalresults ?? "0"),
      tickets: ticketCount,
      extensions: ext,
    });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// ── Start import ──────────────────────────────────────────────────────────────
router.post("/admin/whmcs/import", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const { whmcsUrl, identifier, secret, options = {} } = req.body;
  if (!whmcsUrl || !identifier || !secret) { res.status(400).json({ error: "Missing credentials" }); return; }

  const jobId = crypto.randomUUID();
  const job: ImportJob = {
    jobId, status: "running", step: "Starting…", stepIndex: 0, totalSteps: 9,
    current: 0, total: 0, logs: ["[INFO] WHMCS full migration started"],
    startedAt: new Date().toISOString(),
    result: { extensions:0, plans:0, servers:0, clients:0, services:0, domains:0, orders:0, invoices:0, tickets:0, skipped:0, errors:0 },
  };
  jobs.set(jobId, job);

  const log = (msg: string) => { job.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`); };
  const errLog = (msg: string) => { job.logs.push(`[ERR] ${msg}`); job.result.errors++; };
  const step = (name: string, idx: number) => {
    job.step = name; job.stepIndex = idx; job.current = 0; job.total = 0;
    log(`── Step ${idx}/9: ${name}`);
  };

  (async () => {
    try {
      const o = options;
      const importExtensions = o.importExtensions !== false;
      const importPlans      = o.importPlans      !== false;
      const importServers    = o.importServers    !== false;
      const importClients    = o.importClients    !== false;
      const importPasswords  = o.importPasswords  !== false;
      const importServices   = o.importServices   !== false;
      const importDomains    = o.importDomains    !== false;
      const importOrders     = o.importOrders     !== false;
      const importInvoices   = o.importInvoices   !== false;
      const importTickets    = o.importTickets    !== false;
      const skipExisting     = o.skipExistingClients !== false;

      const clientMap     = new Map<string, string>(); // WHMCS id → our UUID
      const planMap       = new Map<string, string>();
      const serverMap     = new Map<string, string>();
      const serviceMap    = new Map<string, string>();
      const knownWhmcsIds = new Set<string>(); // WHMCS client IDs returned by GetClients (step 4)
      const groupCache = new Map<string, string>(); // WHMCS groupname → our group UUID
      let   defaultPlanId = "";

      // Helper: find or create a product group by name
      async function resolveGroup(groupName: string): Promise<string | null> {
        if (!groupName) return null;
        const norm = groupName.trim();
        if (!norm) return null;
        if (groupCache.has(norm)) return groupCache.get(norm)!;
        const [existing] = await db.select({ id: productGroupsTable.id })
          .from(productGroupsTable)
          .where(sql`lower(${productGroupsTable.name}) = lower(${norm})`)
          .limit(1);
        if (existing) { groupCache.set(norm, existing.id); return existing.id; }
        const slug = norm.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const [created] = await db.insert(productGroupsTable).values({
          name: norm, slug: `${slug}-${Date.now()}`, isActive: true, sortOrder: 99,
        } as any).returning({ id: productGroupsTable.id });
        log(`Created new product group: "${norm}"`);
        groupCache.set(norm, created.id);
        return created.id;
      }

      // ── STEP 1: TLD Extensions ────────────────────────────────────────────
      if (importExtensions) {
        step("Importing TLD extensions & pricing", 1);
        try {
          const tldData = await whmcsCall(whmcsUrl, identifier, secret, "GetTldPricing");
          const pricing = tldData.pricing ?? {};
          const tlds = Object.keys(pricing);
          job.total = tlds.length;
          log(`Found ${tlds.length} TLD extensions`);

          for (const tld of tlds) {
            job.current++;
            const ext  = tld.startsWith(".") ? tld : `.${tld}`;
            const p    = pricing[tld];
            const reg  = parseFloat(p?.register?.["1"] ?? "0")  || 0;
            const ren  = parseFloat(p?.renew?.["1"]   ?? p?.renewal?.["1"] ?? "0") || reg;
            const trf  = parseFloat(p?.transfer?.["1"] ?? "0")  || reg;
            if (reg <= 0) continue;
            try {
              await db.insert(domainExtensionsTable).values({
                extension: ext, registerPrice: reg.toFixed(2), renewalPrice: ren.toFixed(2),
                transferPrice: trf.toFixed(2), status: "active",
                register2YearPrice: p?.register?.["2"] ? parseFloat(p.register["2"]).toFixed(2) : null,
                register3YearPrice: p?.register?.["3"] ? parseFloat(p.register["3"]).toFixed(2) : null,
              } as any).onConflictDoUpdate({
                target: domainExtensionsTable.extension,
                set: { registerPrice: reg.toFixed(2), renewalPrice: ren.toFixed(2), transferPrice: trf.toFixed(2) },
              });
              await db.insert(domainPricingTable).values({
                tld: ext, registrationPrice: reg.toFixed(2), renewalPrice: ren.toFixed(2), transferPrice: trf.toFixed(2),
              } as any).onConflictDoUpdate({
                target: domainPricingTable.tld,
                set: { registrationPrice: reg.toFixed(2), renewalPrice: ren.toFixed(2) },
              });
              job.result.extensions++;
            } catch (e: any) { errLog(`TLD ${ext}: ${e.message}`); }
          }
          log(`Imported/updated ${job.result.extensions} TLD extensions`);
        } catch (e: any) { errLog(`TLD fetch failed: ${e.message}`); }
      }

      // ── STEP 2: Hosting Plans ─────────────────────────────────────────────
      if (importPlans) {
        step("Importing hosting plans", 2);
        try {
          const products = await whmcsPages(whmcsUrl, identifier, secret, "GetProducts", "products", "product");
          job.total = products.length;
          log(`Found ${products.length} products`);

          for (const p of products) {
            job.current++;
            try {
              const pricing  = p.pricing ?? {};
              const monthly  = getPrice(pricing, "monthly");
              const quarterly= getPrice(pricing, "quarterly");
              const semi     = getPrice(pricing, "semiannually");
              const annually = getPrice(pricing, "annually");
              const base     = monthly ?? annually ?? quarterly ?? semi ?? "0";
              const planName = (p.name ?? "Imported Plan").trim();

              const features: string[] = [];
              if (p.diskspace   && p.diskspace   !== "-1") features.push(`${p.diskspace} MB Disk`);
              if (p.bandwidth   && p.bandwidth   !== "-1") features.push(`${p.bandwidth} MB Bandwidth`);
              if (p.numemailaccounts && p.numemailaccounts !== "-1") features.push(`${p.numemailaccounts} Email Accounts`);
              if (p.numdatabases && p.numdatabases !== "-1") features.push(`${p.numdatabases} Databases`);
              if (p.numsubdomains && p.numsubdomains !== "-1") features.push(`${p.numsubdomains} Subdomains`);

              const groupId = await resolveGroup(p.groupname ?? "");

              // Reuse existing plan if name matches — avoids creating duplicates
              const [existingPlan] = await db.select({ id: hostingPlansTable.id })
                .from(hostingPlansTable)
                .where(sql`lower(${hostingPlansTable.name}) = lower(${planName})`)
                .limit(1);

              if (existingPlan) {
                // Update group_id if it wasn't set
                if (groupId) {
                  await db.update(hostingPlansTable)
                    .set({ groupId } as any)
                    .where(eq(hostingPlansTable.id, existingPlan.id));
                }
                planMap.set(String(p.pid), existingPlan.id);
                if (!defaultPlanId) defaultPlanId = existingPlan.id;
                log(`Plan [${p.pid}] "${planName}": matched existing plan${groupId ? ` (group assigned)` : ""}`);
                job.result.plans++;
                continue;
              }

              const [plan] = await db.insert(hostingPlansTable).values({
                name: planName,
                description: p.description || null,
                price: base, yearlyPrice: annually ?? null,
                quarterlyPrice: quarterly ?? null, semiannualPrice: semi ?? null,
                billingCycle: monthly ? "monthly" : "yearly",
                groupId: groupId ?? undefined,
                diskSpace: p.diskspace && p.diskspace !== "-1" ? `${p.diskspace} MB` : "Unlimited",
                bandwidth: p.bandwidth && p.bandwidth !== "-1" ? `${p.bandwidth} MB` : "Unlimited",
                emailAccounts: parseInt(p.numemailaccounts ?? "10") || 10,
                databases: parseInt(p.numdatabases ?? "10") || 10,
                subdomains: parseInt(p.numsubdomains ?? "10") || 10,
                ftpAccounts: parseInt(p.numftpaccounts ?? "5") || 5,
                module: p.servertype ?? p.servtype ?? "cpanel",
                isActive: true, features,
              } as any).returning();
              planMap.set(String(p.pid), plan.id);
              if (!defaultPlanId) defaultPlanId = plan.id;
              job.result.plans++;
            } catch (e: any) { errLog(`Plan [${p.pid}] ${p.name}: ${e.message}`); }
          }
          log(`Imported ${job.result.plans} plans`);
        } catch (e: any) { errLog(`Plans fetch failed: ${e.message}`); }
      }

      if (!defaultPlanId) {
        const [ep] = await db.select({ id: hostingPlansTable.id }).from(hostingPlansTable).limit(1);
        if (ep) defaultPlanId = ep.id;
      }

      // ── STEP 3: Servers ───────────────────────────────────────────────────
      if (importServers) {
        step("Importing servers", 3);
        try {
          const srvData = await whmcsCall(whmcsUrl, identifier, secret, "GetServers", { fetchmodule: "1" });
          // Log raw response keys for debugging
          const srvKeys = Object.keys(srvData ?? {}).join(",");
          log(`[GetServers raw] result=${srvData?.result}, keys=${srvKeys}, totalresults=${srvData?.totalresults}`);
          if (srvData?.servers !== undefined) log(`[GetServers] servers type=${typeof srvData.servers}, isArray=${Array.isArray(srvData.servers)}, value=${JSON.stringify(srvData.servers).slice(0, 200)}`);

          // Handle all known WHMCS response formats:
          //   v7: { servers: { server: [...] } }
          //   v8+: { servers: [...] }  OR  { servers: { server: [..] } }
          //   empty: { servers: [] }  OR  { totalresults: "0" }
          let rawServers: any[] = [];
          const sv = srvData?.servers;
          if (Array.isArray(sv)) {
            rawServers = sv;
          } else if (sv && typeof sv === "object") {
            rawServers = toArray(sv.server ?? sv);
          }
          // Filter out empty objects that come from empty WHMCS array responses
          rawServers = rawServers.filter((s: any) => s && (s.id || s.hostname || s.ipaddress));
          job.total = rawServers.length;
          log(`Found ${rawServers.length} servers`);

          // Pre-load existing server hostnames to avoid duplicates on re-run
          const existingServerHostnames = new Set<string>();
          const existingServerRows = await db.select({ hostname: serversTable.hostname }).from(serversTable);
          for (const r of existingServerRows) { if (r.hostname) existingServerHostnames.add(r.hostname); }

          for (const s of rawServers) {
            job.current++;
            const hostname = s.hostname || s.ipaddress || "server.example.com";
            if (existingServerHostnames.has(hostname)) {
              log(`  Server "${s.name}" (${hostname}) already exists — skipping`);
              job.result.skipped++;
              continue;
            }
            try {
              // Use WHMCS accesshash as WHM API token (enables cPanel SSO after migration)
              const apiToken = s.accesshash?.trim() || null;
              const [srv] = await db.insert(serversTable).values({
                name: s.name ?? "WHMCS Server",
                hostname,
                ipAddress: s.ipaddress || null,
                type: (s.type || s.module || "cpanel").toLowerCase() === "directadmin" ? "cpanel" : "cpanel",
                apiUsername: s.username || "root",
                apiToken,
                apiPort: parseInt(s.port ?? "2087") || 2087,
                ns1: s.nameserver1 || null, ns2: s.nameserver2 || null,
                maxAccounts: parseInt(s.maxaccounts ?? "500") || 500,
                status: "active", isDefault: false,
              } as any).returning();
              serverMap.set(String(s.id), srv.id);
              serverMap.set(String(s.name), srv.id);
              job.result.servers++;
              log(`  Imported server "${s.name}" (${hostname})${apiToken ? " ✓ WHM token" : " ⚠ no WHM token"}`);
            } catch (e: any) { errLog(`Server [${s.id}]: ${e.message}`); }
          }
          log(`Imported ${job.result.servers} servers`);
        } catch (e: any) { errLog(`Servers failed: ${e.message}`); }
      }

      // ── STEP 4: Clients ───────────────────────────────────────────────────
      if (importClients) {
        step("Importing clients", 4);
        try {
          const clients = await whmcsPages(whmcsUrl, identifier, secret, "GetClients", "clients", "client");
          job.total = clients.length;
          log(`Found ${clients.length} clients`);

          const passwordMap = new Map<string, string>();
          if (importPasswords && clients.length > 0) {
            log(`Fetching passwords for ${clients.length} clients (3 at a time)…`);
            let fetched = 0;
            let earlyExit = false;
            const batchSize = 3;
            for (let b = 0; b < clients.length; b += batchSize) {
              if (earlyExit) break;
              const chunk = clients.slice(b, b + batchSize);
              await Promise.all(chunk.map(async (c) => {
                try {
                  const detail = await whmcsCall(whmcsUrl, identifier, secret, "GetClientsDetails", { clientid: c.id, stats: false });
                  const rawHash = detail.client?.password ?? detail.password ?? "";
                  const hash = normalizeHash(rawHash);
                  if (hash) passwordMap.set(String(c.id), hash);
                } catch {}
                fetched++;
              }));
              // Early exit: if WHMCS doesn't return password hashes at all, stop wasting time
              if (fetched >= 20 && passwordMap.size === 0) {
                log(`  ⚠ WHMCS API does not expose password hashes — skipping remaining ${clients.length - fetched} clients (temp passwords will be used)`);
                earlyExit = true;
                break;
              }
              if (fetched % 150 === 0 || fetched === clients.length) log(`  Passwords: ${fetched}/${clients.length} (found: ${passwordMap.size})`);
              await sleep(200);
            }
            log(`Got passwords for ${passwordMap.size} clients`);
          }

          for (const c of clients) {
            job.current++;
            // Track all WHMCS IDs we see, so ensureClient can avoid API calls for deleted clients
            if (c.id) knownWhmcsIds.add(String(c.id));
            const email = (c.email ?? "").toLowerCase().trim();
            if (!email) { job.result.skipped++; continue; }

            try {
              const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
                .where(eq(usersTable.email, email)).limit(1);

              if (existing) {
                clientMap.set(String(c.id), existing.id);
                if (!skipExisting) {
                  await db.update(usersTable).set({
                    firstName: c.firstname || "Client", lastName: c.lastname || String(c.id),
                    company: c.companyname || null, phone: c.phonenumber || null,
                    status: clientStatus(c.status ?? "Active"),
                    creditBalance: parseFloat(c.credit ?? "0").toFixed(2),
                  }).where(eq(usersTable.id, existing.id));
                }
                job.result.skipped++;
                continue;
              }

              const whmcsHash  = passwordMap.get(String(c.id));
              // Fallback: reproducible temp hash so client can login if we don't have their password
              const tempHash   = `whmcs_md5:${createHash("md5").update(createHash("md5").update(`nexgo_${c.id}`).digest("hex")).digest("hex")}`;
              const passwordHash = whmcsHash ?? tempHash;

              const [user] = await db.insert(usersTable).values({
                firstName: c.firstname || "Client",
                lastName:  c.lastname  || String(c.id),
                email, passwordHash,
                company: c.companyname || null, phone: c.phonenumber || null,
                role: "client", status: clientStatus(c.status ?? "Active"),
                emailVerified: true,
                creditBalance: parseFloat(c.credit ?? "0").toFixed(2),
                createdAt: parseDate(c.datecreated) ?? new Date(),
              } as any).returning();

              clientMap.set(String(c.id), user.id);
              job.result.clients++;
            } catch (e: any) { errLog(`Client [${c.id}] ${email}: ${e.message}`); }
          }
          log(`Imported ${job.result.clients} clients, ${job.result.skipped} skipped`);
        } catch (e: any) { errLog(`Clients failed: ${e.message}`); }
      }

      // Give WHMCS API rate limit time to recover after password fetching
      await sleep(3000);

      // ── Client lookup: resolve a WHMCS client ID to our internal UUID.
      //    STRICT MODE: If a client ID is NOT in our known Pakistan client list,
      //    we return null and the caller skips that record entirely.
      //    We NEVER create placeholder/archived/fake accounts.
      const missingClientCache = new Map<string, string | null>(); // whmcsId → our UUID or null
      async function ensureClient(whmcsId: string): Promise<string | null> {
        if (!whmcsId || whmcsId === "0") return null;
        if (clientMap.has(whmcsId)) return clientMap.get(whmcsId)!;
        if (missingClientCache.has(whmcsId)) return missingClientCache.get(whmcsId) ?? null;

        // If this ID was never in the GetClients Pakistan list → it's a deleted/
        // archived/US client. Skip it — do NOT create a placeholder account.
        if (!knownWhmcsIds.has(whmcsId)) {
          missingClientCache.set(whmcsId, null);
          return null;
        }

        // ID is known (Pakistan client) but wasn't imported yet — try to fetch details.
        try {
          const detail = await whmcsCall(whmcsUrl, identifier, secret, "GetClientsDetails", { clientid: whmcsId, stats: false });
          const c = detail.client ?? detail;
          const fetchedEmail = ((c.email ?? c.Email ?? "")).toLowerCase().trim();
          if (!fetchedEmail) {
            missingClientCache.set(whmcsId, null);
            return null; // No email — skip
          }
          const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
            .where(eq(usersTable.email, fetchedEmail)).limit(1);
          if (existing) {
            clientMap.set(whmcsId, existing.id);
            missingClientCache.set(whmcsId, existing.id);
            return existing.id;
          }
        } catch { /* skip this client */ }

        missingClientCache.set(whmcsId, null);
        return null;
      }

      // ── STEP 5: Hosting Services ──────────────────────────────────────────
      if (importServices) {
        step("Importing hosting services", 5);
        try {
          // Pre-load existing services (clientId:domain) → {key → serviceId, serverId}
          const existingServices = new Map<string, { id: string; serverId: string | null }>();
          const existingServiceRows = await db.select({
            id: hostingServicesTable.id,
            clientId: hostingServicesTable.clientId,
            domain: hostingServicesTable.domain,
            serverId: hostingServicesTable.serverId,
          }).from(hostingServicesTable);
          for (const r of existingServiceRows) {
            if (r.clientId && r.domain) existingServices.set(`${r.clientId}:${r.domain.toLowerCase().trim()}`, { id: r.id, serverId: r.serverId });
          }

          const services = await whmcsPages(whmcsUrl, identifier, secret, "GetClientsProducts", "products", "product");
          job.total = services.length;
          log(`Found ${services.length} hosting services`);

          for (const s of services) {
            job.current++;
            const clientId = await ensureClient(String(s.clientid ?? s.userid ?? ""));
            if (!clientId) { job.result.skipped++; continue; }
            const planId = planMap.get(String(s.pid)) ?? defaultPlanId;
            if (!planId) { job.result.skipped++; continue; }

            // Skip if already imported on a previous run — but update server link if missing
            const domNorm = (s.domain || "").toLowerCase().trim();
            const svcKey = `${clientId}:${domNorm}`;
            const serverId = serverMap.get(String(s.serverid)) ?? null;
            if (domNorm && existingServices.has(svcKey)) {
              const existing = existingServices.get(svcKey)!;
              // If this service was imported without a server link, patch it now that servers are imported
              if (!existing.serverId && serverId) {
                await db.update(hostingServicesTable)
                  .set({ serverId, serverIp: s.serverip || s.dedicatedip || null,
                         cpanelUrl: s.serverip ? `https://${s.serverip}:2083` : undefined,
                         updatedAt: new Date() })
                  .where(eq(hostingServicesTable.id, existing.id));
              }
              job.result.skipped++;
              continue;
            }

            try {
              const [svc] = await db.insert(hostingServicesTable).values({
                clientId, planId,
                planName: s.name || s.groupname || "Hosting Service",
                domain: domNorm || null, username: s.username || null, password: null,
                serverId, serverIp: s.serverip || s.dedicatedip || null,
                cpanelUrl: s.serverip ? `https://${s.serverip}:2083` : null,
                status: serviceStatus(s.status ?? "Active"),
                billingCycle: billingCycle(s.billingcycle ?? "Monthly"),
                nextDueDate: parseDate(s.nextduedate),
                startDate: parseDate(s.regdate) ?? new Date(),
                expiryDate: parseDate(s.nextduedate),
                diskUsed: s.diskusage ? `${s.diskusage} MB` : "0 MB",
                bandwidthUsed: s.bwusage ? `${s.bwusage} MB` : "0 GB",
                autoRenew: true, cancelRequested: false,
              } as any).returning();
              serviceMap.set(String(s.id), svc.id);
              if (domNorm) existingServices.set(svcKey, { id: svc.id, serverId }); // prevent within-run dups
              job.result.services++;
            } catch (e: any) { errLog(`Service [${s.id}]: ${e.message}`); }
          }
          log(`Imported ${job.result.services} hosting services`);
        } catch (e: any) { errLog(`Services failed: ${e.message}`); }
      }

      // ── STEP 6: Domains ───────────────────────────────────────────────────
      if (importDomains) {
        step("Importing domains", 6);
        try {
          // Pre-load existing domain names to avoid duplicates on re-run
          const existingDomains = new Set<string>();
          const existingDomainRows = await db.select({ name: domainsTable.name, tld: domainsTable.tld }).from(domainsTable);
          for (const r of existingDomainRows) existingDomains.add(`${r.name}${r.tld}`);

          const allDomains = await whmcsPages(whmcsUrl, identifier, secret, "GetClientsDomains", "domains", "domain");
          log(`Found ${allDomains.length} raw domain records from WHMCS`);

          // WHMCS returns multiple records per domain (e.g. cancelled + active after transfer).
          // Pre-deduplicate: keep the best record per name+tld (active > pending > others, then most recent id).
          const statusPriority: Record<string, number> = { Active:1, Pending:2, Grace:3, Expired:4, "Transferred Away":5, Cancelled:6, Fraud:7 };
          const domainBest = new Map<string, any>();
          for (const d of allDomains) {
            const full = (d.domainname ?? "").toLowerCase().trim();
            if (!full) continue;
            const { name, tld } = splitDomain(full);
            const key = `${name}${tld}`;
            const prev = domainBest.get(key);
            if (!prev) { domainBest.set(key, d); continue; }
            const p1 = statusPriority[d.status ?? ""] ?? 99;
            const p2 = statusPriority[prev.status ?? ""] ?? 99;
            if (p1 < p2 || (p1 === p2 && parseInt(d.id) > parseInt(prev.id))) domainBest.set(key, d);
          }
          const domains = Array.from(domainBest.values());
          log(`Deduplicated to ${domains.length} unique domains`);
          job.total = domains.length;

          for (const d of domains) {
            job.current++;
            const clientId = await ensureClient(String(d.userid ?? d.clientid ?? ""));
            if (!clientId) { job.result.skipped++; continue; }
            const full = (d.domainname ?? "").toLowerCase().trim();
            if (!full) { job.result.skipped++; continue; }
            const { name, tld } = splitDomain(full);

            // Skip if already imported on a previous run
            if (existingDomains.has(`${name}${tld}`)) { job.result.skipped++; continue; }

            try {
              await db.insert(domainsTable).values({
                clientId, name, tld: tld || ".com",
                registrar: d.registrar || null,
                registrationDate: parseDate(d.regdate) ?? new Date(),
                expiryDate:  parseDate(d.expirydate),
                nextDueDate: parseDate(d.nextduedate),
                status: domainStatus(d.status ?? "Active"),
                lockStatus: "locked",
                autoRenew: d.autorenew === "1" || d.autorenew === true,
                nameservers: [d.nameserver1, d.nameserver2, d.nameserver3, d.nameserver4].filter(Boolean) as string[],
              } as any);
              existingDomains.add(`${name}${tld}`); // track within same run to avoid same-run duplicates
              job.result.domains++;
            } catch (e: any) { errLog(`Domain [${d.id}] ${d.domainname}: ${e.message}`); }
          }
          log(`Imported ${job.result.domains} domains`);
        } catch (e: any) { errLog(`Domains failed: ${e.message}`); }
      }

      // ── STEP 7: Orders ────────────────────────────────────────────────────
      if (importOrders) {
        step("Importing orders", 7);
        try {
          // Pre-load existing WHMCS order IDs to prevent re-run duplicates
          const existingOrders = new Set<string>();
          const existingOrderRows = await db.select({ whmcsId: ordersTable.whmcsId }).from(ordersTable)
            .where(sql`${ordersTable.whmcsId} IS NOT NULL`);
          for (const r of existingOrderRows) { if (r.whmcsId) existingOrders.add(r.whmcsId); }
          log(`  Pre-loaded ${existingOrders.size} existing WHMCS order IDs`);

          const orders = await whmcsPages(whmcsUrl, identifier, secret, "GetOrders", "orders", "order");
          job.total = orders.length;
          log(`Found ${orders.length} orders`);

          for (const o of orders) {
            job.current++;
            const clientId = await ensureClient(String(o.userid ?? o.clientid ?? ""));
            if (!clientId) { job.result.skipped++; continue; }

            const whmcsOrderId = String(o.id ?? "");
            if (!whmcsOrderId || existingOrders.has(whmcsOrderId)) { job.result.skipped++; continue; }

            const lineItems = toArray(o.lineItems?.lineItem);
            const first = lineItems[0];
            const orderType: "hosting" | "domain" | "renewal" =
              first?.type === "domain" ? "domain" :
              first?.type === "domainrenew" ? "renewal" : "hosting";

            try {
              await db.insert(ordersTable).values({
                clientId,
                type: orderType,
                itemId: first?.relid ? (serviceMap.get(String(first.relid)) ?? planMap.get(String(first.relid)) ?? null) : null,
                itemName: first?.product ?? `Order #${o.id}`,
                domain: first?.domain ?? o.domain ?? null,
                amount: parseFloat(o.amount ?? "0").toFixed(2),
                billingCycle: billingCycle(first?.billingcycle ?? "Monthly"),
                dueDate: parseDate(o.date) ?? new Date(),
                paymentStatus: o.paymentstatus === "Paid" ? "paid" : "unpaid",
                status: orderStatus(o.status ?? "Active"),
                notes: o.notes || null,
                whmcsId: whmcsOrderId,
                createdAt: parseDate(o.date) ?? new Date(),
              } as any);
              existingOrders.add(whmcsOrderId); // prevent within-run dups
              job.result.orders++;
            } catch (e: any) { errLog(`Order [${o.id}]: ${e.message}`); }
          }
          log(`Imported ${job.result.orders} orders`);
        } catch (e: any) { errLog(`Orders failed: ${e.message}`); }
      }

      // ── STEP 8: Invoices ──────────────────────────────────────────────────
      if (importInvoices) {
        step("Importing invoices", 8);
        try {
          const invoices = await whmcsPages(whmcsUrl, identifier, secret, "GetInvoices", "invoices", "invoice");
          job.total = invoices.length;
          log(`Found ${invoices.length} invoices`);

          // Diagnostic: count userid=0/empty invoices
          const noUserInvs = invoices.filter((i: any) => !i.userid || i.userid === "0" || i.userid === 0).length;
          if (noUserInvs > 0) log(`  ⚠ ${noUserInvs} invoices have no userid (will be skipped)`);
          log(`  Sample invoice fields: ${JSON.stringify(Object.keys(invoices[0] ?? {}))}`);

          // Pre-load existing invoice numbers to silently skip on re-run (no errors)
          const existingInvoiceNums = new Set<string>();
          const existingInvRows = await db.select({ invoiceNumber: invoicesTable.invoiceNumber }).from(invoicesTable);
          for (const r of existingInvRows) { if (r.invoiceNumber) existingInvoiceNums.add(r.invoiceNumber); }
          log(`  Pre-loaded ${existingInvoiceNums.size} existing invoice numbers (will skip)`);

          let invSkippedNoClient = 0, invSkippedExisting = 0, invInserted = 0, invFailed = 0;

          for (const inv of invoices) {
            job.current++;
            const clientId = await ensureClient(String(inv.userid ?? inv.clientid ?? ""));
            if (!clientId) { job.result.skipped++; invSkippedNoClient++; continue; }

            const invNum   = buildInvoiceNumber(inv);
            // Skip both primary and fallback numbers if already imported
            if (existingInvoiceNums.has(invNum) || existingInvoiceNums.has(`${invNum}-W${inv.id}`)) {
              job.result.skipped++; invSkippedExisting++;
              continue;
            }

            const dueDate  = parseDate(inv.duedate) ?? new Date();
            const paidDate = parseDate(inv.datepaid);
            const amount   = parseFloat(inv.subtotal ?? "0") || 0;
            const tax      = parseFloat(inv.tax ?? "0") || 0;
            const total    = parseFloat(inv.total ?? "0") || 0;
            const status   = invoiceStatus(inv.status ?? "Unpaid");

            const whmcsItems = toArray(inv.items?.item);
            const items = whmcsItems.length > 0
              ? whmcsItems.map((it: any) => ({
                  description: it.description ?? "Service",
                  amount: parseFloat(it.amount ?? "0") || 0,
                }))
              : [{ description: `WHMCS Invoice #${inv.id}`, amount: total }];

            const rowBase = {
              clientId, amount: amount.toFixed(2), tax: tax.toFixed(2), total: total.toFixed(2),
              status, dueDate,
              paidDate: status === "paid" ? (paidDate ?? new Date()) : null,
              items, // pass actual array — jsonb column, NOT JSON.stringify
              paymentNotes: inv.paymentmethod ? `Paid via ${inv.paymentmethod}` : null,
              invoiceType: "hosting",
              createdAt: parseDate(inv.date) ?? new Date(),
            };

            try {
              await db.insert(invoicesTable).values({ invoiceNumber: invNum, ...rowBase } as any);
              existingInvoiceNums.add(invNum);
              job.result.invoices++; invInserted++;
            } catch (dupErr: any) {
              const cause = dupErr.cause?.message ?? dupErr.message ?? String(dupErr);
              if (dupErr.message?.includes("unique") || dupErr.code === "23505" || cause.includes("unique")) {
                const fallbackNum = `${invNum}-W${inv.id}`;
                if (!existingInvoiceNums.has(fallbackNum)) {
                  try {
                    await db.insert(invoicesTable).values({ invoiceNumber: fallbackNum, ...rowBase } as any);
                    existingInvoiceNums.add(fallbackNum);
                    job.result.invoices++; invInserted++;
                  } catch (e2: any) {
                    const c2 = e2.cause?.message ?? e2.message ?? String(e2);
                    errLog(`Invoice [${inv.id}] fallback: ${c2}`);
                    invFailed++;
                  }
                } else {
                  job.result.skipped++; invSkippedExisting++;
                }
              } else {
                invFailed++;
                errLog(`Invoice [${inv.id}] status=${rowBase.status} amt=${rowBase.total}: ${cause}`);
              }
            }
          }
          log(`Invoices — imported:${invInserted} skipped-existing:${invSkippedExisting} no-client:${invSkippedNoClient} failed:${invFailed}`);
        } catch (e: any) { errLog(`Invoices failed: ${e.message}`); }
      }

      // ── STEP 9: Tickets ───────────────────────────────────────────────────
      if (importTickets) {
        step("Importing support tickets", 9);
        try {
          // Fetch all tickets across all statuses using ignore_dept_assignments
          // to bypass department-level permission filters in WHMCS
          const tickets = await whmcsPages(whmcsUrl, identifier, secret, "GetTickets", "tickets", "ticket", {
            ignore_dept_assignments: "1",
          });
          job.total = tickets.length;
          log(`Found ${tickets.length} tickets`);

          // Use admin user ID for admin replies
          const [adminUser] = await db.select({ id: usersTable.id }).from(usersTable)
            .where(eq(usersTable.role as any, "admin")).limit(1);
          const adminId = adminUser?.id ?? "admin";

          for (const t of tickets) {
            job.current++;
            const clientId = await ensureClient(String(t.userid ?? t.c ?? ""));
            if (!clientId) { job.result.skipped++; continue; }

            // Use WHMCS tid (e.g. "ABC-123456") as ticket number
            const ticketNum = (t.tid ?? t.id ?? crypto.randomUUID()).toString();

            try {
              // Upsert ticket (skip if duplicate ticket number)
              const [ticket] = await db.insert(ticketsTable).values({
                ticketNumber: ticketNum,
                clientId,
                subject: t.subject || "Support Request",
                status: ticketStatus(t.status ?? "Open"),
                priority: ticketPriority(t.urgency ?? t.priority ?? "Medium"),
                department: t.deptname || "General",
                messagesCount: parseInt(t.replies ?? "0") || 0,
                lastReply: parseDate(t.lastreply),
                createdAt: parseDate(t.date) ?? new Date(),
                updatedAt: parseDate(t.lastreply ?? t.date) ?? new Date(),
              } as any).onConflictDoNothing().returning();

              if (!ticket) { job.result.skipped++; continue; }

              // Fetch ticket messages
              try {
                const detail = await whmcsCall(whmcsUrl, identifier, secret, "GetTicket", { ticketid: t.id });
                const replies = toArray(detail.replies?.reply);

                // Import the original message body if available
                if (detail.message) {
                  await db.insert(ticketMessagesTable).values({
                    ticketId: ticket.id,
                    senderId: clientId,
                    senderName: `${t.name ?? "Client"}`,
                    senderRole: "client",
                    message: detail.message,
                    attachments: [],
                    createdAt: parseDate(t.date) ?? new Date(),
                  } as any).onConflictDoNothing();
                }

                // Import all replies
                for (const reply of replies) {
                  const isAdmin = !!(reply.admin && reply.admin !== "");
                  const senderName = isAdmin ? (reply.admin || "Support") : (reply.name || "Client");
                  const senderId   = isAdmin ? adminId : (clientMap.get(String(reply.userid)) ?? clientId);
                  await db.insert(ticketMessagesTable).values({
                    ticketId: ticket.id,
                    senderId,
                    senderName,
                    senderRole: isAdmin ? "admin" : "client",
                    message: reply.message || "(no content)",
                    attachments: reply.attachment ? [reply.attachment] : [],
                    createdAt: parseDate(reply.date) ?? new Date(),
                  } as any).onConflictDoNothing();
                }
              } catch {}

              job.result.tickets++;
            } catch (e: any) {
              if (e.message?.includes("unique") || e.code === "23505") {
                job.result.skipped++;
              } else {
                errLog(`Ticket [${t.id}]: ${e.message}`);
              }
            }
          }
          log(`Imported ${job.result.tickets} tickets`);
        } catch (e: any) { errLog(`Tickets failed: ${e.message}`); }
      }

      // ── Done ─────────────────────────────────────────────────────────────
      job.status = "completed";
      job.step = "Complete";
      job.completedAt = new Date().toISOString();
      log("✅ Full WHMCS migration completed!");
      log(
        `Summary → TLDs:${job.result.extensions} | Plans:${job.result.plans} | ` +
        `Servers:${job.result.servers} | Clients:${job.result.clients} | ` +
        `Services:${job.result.services} | Domains:${job.result.domains} | ` +
        `Orders:${job.result.orders} | Invoices:${job.result.invoices} | ` +
        `Tickets:${job.result.tickets} | Skipped:${job.result.skipped} | Errors:${job.result.errors}`,
      );
    } catch (e: any) {
      job.status = "failed";
      job.step = "Failed";
      job.logs.push(`[FATAL] ${e.message}`);
    }
  })();

  res.json({ jobId, message: "Migration started" });
});

// ── Poll status ───────────────────────────────────────────────────────────────
router.get("/admin/whmcs/import/:jobId/status", authenticate, requireAdmin, async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json({
    jobId: job.jobId, status: job.status, step: job.step,
    stepIndex: job.stepIndex, totalSteps: job.totalSteps,
    current: job.current, total: job.total,
    logs: job.logs,
    result: job.result,
    startedAt: job.startedAt, completedAt: job.completedAt,
  });
});

// ── Recent jobs ───────────────────────────────────────────────────────────────
router.get("/admin/whmcs/jobs", authenticate, requireAdmin, async (_req, res) => {
  res.json(
    Array.from(jobs.values())
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 5)
      .map(j => ({ jobId: j.jobId, status: j.status, step: j.step, result: j.result, startedAt: j.startedAt, completedAt: j.completedAt }))
  );
});

export default router;
