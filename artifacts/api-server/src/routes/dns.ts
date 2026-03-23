import { Router } from "express";
import { db } from "@workspace/db";
import { hostingServicesTable, dnsRecordsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../lib/auth.js";

const router = Router();

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_BASE = "https://api.cloudflare.com/client/v4";

// ── Cloudflare helpers (optional — only used when CLOUDFLARE_API_TOKEN is set) ─

async function cfFetch(path: string, opts: RequestInit = {}) {
  const resp = await fetch(`${CF_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const json: any = await resp.json();
  if (!json.success) throw new Error(json.errors?.[0]?.message || "Cloudflare API error");
  return json.result;
}

async function getCfZoneId(domain: string): Promise<string | null> {
  try {
    const zones = await cfFetch(`/zones?name=${domain}&status=active`);
    return zones?.[0]?.id || null;
  } catch {
    return null;
  }
}

async function cfGetRecords(zoneId: string) {
  return cfFetch(`/zones/${zoneId}/dns_records?per_page=100`);
}

async function cfAddRecord(zoneId: string, type: string, name: string, content: string, ttl: number, priority?: number) {
  const body: any = { type, name, content, ttl };
  if (priority !== undefined) body.priority = priority;
  return cfFetch(`/zones/${zoneId}/dns_records`, { method: "POST", body: JSON.stringify(body) });
}

async function cfUpdateRecord(zoneId: string, recordId: string, type: string, name: string, content: string, ttl: number, priority?: number) {
  const body: any = { type, name, content, ttl };
  if (priority !== undefined) body.priority = priority;
  return cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, { method: "PUT", body: JSON.stringify(body) });
}

async function cfDeleteRecord(zoneId: string, recordId: string) {
  return cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, { method: "DELETE" });
}

// ── Map Cloudflare records → internal format ───────────────────────────────────
function normalizeCfRecord(r: any, idx: number) {
  return {
    line: idx,
    id: r.id,
    type: r.type,
    name: r.name,
    address: r.content,
    ttl: r.ttl,
    priority: r.priority,
    source: "cloudflare",
  };
}

// ── Map DB records → internal format ──────────────────────────────────────────
function normalizeDbRecord(r: any) {
  return {
    line: r.id,
    id: r.id,
    type: r.type,
    name: r.name,
    address: r.value,
    ttl: r.ttl,
    priority: r.priority,
    source: "local",
  };
}

async function getServiceForUser(serviceId: string, userId: string, isAdmin: boolean) {
  const [service] = await db.select().from(hostingServicesTable)
    .where(isAdmin ? eq(hostingServicesTable.id, serviceId) : and(eq(hostingServicesTable.id, serviceId), eq(hostingServicesTable.clientId, userId)))
    .limit(1);
  return service || null;
}

// ── GET /hosting/:id/dns — list DNS records ────────────────────────────────────
router.get("/hosting/:id/dns", authenticate, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user!.role === "admin";
    const service = await getServiceForUser(req.params.id, req.user!.userId, isAdmin);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    if (!service.domain) { res.json({ records: [], domain: null, message: "No domain configured for this service" }); return; }

    const domain = service.domain;

    // Try Cloudflare first if token is configured
    if (CF_TOKEN) {
      const zoneId = await getCfZoneId(domain);
      if (zoneId) {
        const cfRecords = await cfGetRecords(zoneId);
        const records = cfRecords.map(normalizeCfRecord);
        res.json({ records, domain, source: "cloudflare" });
        return;
      }
    }

    // Fallback: local DB records
    const dbRecords = await db.select().from(dnsRecordsTable)
      .where(and(eq(dnsRecordsTable.serviceId, service.id), eq(dnsRecordsTable.domain, domain)));
    const records = dbRecords.map(normalizeDbRecord);

    if (records.length === 0) {
      // Seed default records for new services
      const defaults = [
        { type: "A", name: domain, value: service.serverIp || "127.0.0.1", ttl: 3600 },
        { type: "A", name: `www.${domain}`, value: service.serverIp || "127.0.0.1", ttl: 3600 },
        { type: "MX", name: domain, value: `mail.${domain}`, ttl: 3600, priority: 10 },
        { type: "TXT", name: domain, value: "v=spf1 include:nexgohost.com ~all", ttl: 3600 },
      ];
      const inserted = await db.insert(dnsRecordsTable).values(
        defaults.map(d => ({ serviceId: service.id, domain, ...d }))
      ).returning();
      res.json({ records: inserted.map(normalizeDbRecord), domain, source: "local" });
      return;
    }

    res.json({ records, domain, source: "local" });
  } catch (err: any) {
    console.error("[DNS] fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch DNS records", message: err.message });
  }
});

// ── POST /hosting/:id/dns — add DNS record ─────────────────────────────────────
router.post("/hosting/:id/dns", authenticate, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user!.role === "admin";
    const service = await getServiceForUser(req.params.id, req.user!.userId, isAdmin);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    if (!service.domain) { res.status(400).json({ error: "No domain configured for this service" }); return; }

    const { type, name, address, ttl = 3600, priority } = req.body;
    if (!type || !name || !address) {
      res.status(400).json({ error: "type, name, and address are required" }); return;
    }

    const validTypes = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"];
    if (!validTypes.includes(type.toUpperCase())) {
      res.status(400).json({ error: `Unsupported record type. Supported: ${validTypes.join(", ")}` }); return;
    }

    const domain = service.domain;

    // Try Cloudflare if configured
    if (CF_TOKEN) {
      const zoneId = await getCfZoneId(domain);
      if (zoneId) {
        const result = await cfAddRecord(zoneId, type.toUpperCase(), name, address, ttl, priority);
        res.json({ success: true, record: normalizeCfRecord(result, 0), source: "cloudflare" });
        return;
      }
    }

    // Local DB
    const [record] = await db.insert(dnsRecordsTable).values({
      serviceId: service.id,
      domain,
      type: type.toUpperCase(),
      name: name.trim(),
      value: address.trim(),
      ttl: Number(ttl) || 3600,
      priority: priority ? Number(priority) : null,
    }).returning();

    res.json({ success: true, record: normalizeDbRecord(record), source: "local" });
  } catch (err: any) {
    console.error("[DNS] add error:", err.message);
    res.status(500).json({ error: "Failed to add DNS record", message: err.message });
  }
});

// ── PUT /hosting/:id/dns/:line — update DNS record ────────────────────────────
router.put("/hosting/:id/dns/:line", authenticate, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user!.role === "admin";
    const service = await getServiceForUser(req.params.id, req.user!.userId, isAdmin);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    if (!service.domain) { res.status(400).json({ error: "No domain configured" }); return; }

    const { type, name, address, ttl = 3600, priority } = req.body;
    if (!type || !name || !address) {
      res.status(400).json({ error: "type, name, and address are required" }); return;
    }

    const recordId = req.params.line;
    const domain = service.domain;

    // Try Cloudflare if configured
    if (CF_TOKEN) {
      const zoneId = await getCfZoneId(domain);
      if (zoneId) {
        const result = await cfUpdateRecord(zoneId, recordId, type.toUpperCase(), name, address, ttl, priority);
        res.json({ success: true, record: normalizeCfRecord(result, 0), source: "cloudflare" });
        return;
      }
    }

    // Local DB
    const [updated] = await db.update(dnsRecordsTable)
      .set({ type: type.toUpperCase(), name: name.trim(), value: address.trim(), ttl: Number(ttl) || 3600, priority: priority ? Number(priority) : null, updatedAt: new Date() })
      .where(and(eq(dnsRecordsTable.id, recordId), eq(dnsRecordsTable.serviceId, service.id)))
      .returning();

    if (!updated) { res.status(404).json({ error: "DNS record not found" }); return; }
    res.json({ success: true, record: normalizeDbRecord(updated), source: "local" });
  } catch (err: any) {
    console.error("[DNS] edit error:", err.message);
    res.status(500).json({ error: "Failed to update DNS record", message: err.message });
  }
});

// ── DELETE /hosting/:id/dns/:line — delete DNS record ─────────────────────────
router.delete("/hosting/:id/dns/:line", authenticate, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user!.role === "admin";
    const service = await getServiceForUser(req.params.id, req.user!.userId, isAdmin);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    if (!service.domain) { res.status(400).json({ error: "No domain configured" }); return; }

    const recordId = req.params.line;
    const domain = service.domain;

    // Try Cloudflare if configured
    if (CF_TOKEN) {
      const zoneId = await getCfZoneId(domain);
      if (zoneId) {
        await cfDeleteRecord(zoneId, recordId);
        res.json({ success: true, source: "cloudflare" });
        return;
      }
    }

    // Local DB
    const deleted = await db.delete(dnsRecordsTable)
      .where(and(eq(dnsRecordsTable.id, recordId), eq(dnsRecordsTable.serviceId, service.id)))
      .returning();

    if (!deleted.length) { res.status(404).json({ error: "DNS record not found" }); return; }
    res.json({ success: true, source: "local" });
  } catch (err: any) {
    console.error("[DNS] delete error:", err.message);
    res.status(500).json({ error: "Failed to delete DNS record", message: err.message });
  }
});

export default router;
