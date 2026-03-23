import { Router } from "express";
import { db } from "@workspace/db";
import { hostingServicesTable, serversTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { cpanelGetDnsZone, cpanelAddDnsRecord, cpanelEditDnsRecord, cpanelDeleteDnsRecord } from "../lib/cpanel.js";

const router = Router();

async function getServiceAndServer(serviceId: string, userId: string, isAdmin: boolean) {
  const [service] = await db.select().from(hostingServicesTable)
    .where(isAdmin ? eq(hostingServicesTable.id, serviceId) : and(eq(hostingServicesTable.id, serviceId), eq(hostingServicesTable.clientId, userId)))
    .limit(1);
  if (!service) return { service: null, server: null };
  const [server] = service.serverId
    ? await db.select().from(serversTable).where(eq(serversTable.id, service.serverId)).limit(1)
    : [];
  return { service, server: server || null };
}

// GET /hosting/:id/dns — list DNS records for hosting service
router.get("/hosting/:id/dns", authenticate, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user!.role === "admin";
    const { service, server } = await getServiceAndServer(req.params.id, req.user!.userId, isAdmin);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    if (!service.domain) { res.json({ records: [], message: "No domain configured" }); return; }

    if (!server || !service.username) {
      // Return demo/empty records when no server configured
      res.json({ records: [], domain: service.domain, message: "No server configured — DNS records unavailable" });
      return;
    }

    const serverConfig = { hostname: server.hostname, port: Number(server.port || 2087), username: server.username, apiToken: server.apiToken || "" };
    const records = await cpanelGetDnsZone(serverConfig, service.domain, service.username);
    res.json({ records, domain: service.domain });
  } catch (err: any) {
    console.error("[DNS] fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch DNS records", message: err.message });
  }
});

// POST /hosting/:id/dns — add DNS record
router.post("/hosting/:id/dns", authenticate, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user!.role === "admin";
    const { service, server } = await getServiceAndServer(req.params.id, req.user!.userId, isAdmin);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    if (!server || !service.username || !service.domain) {
      res.status(400).json({ error: "Server not configured" }); return;
    }

    const { type, name, address, cname, exchange, txtdata, ttl, preference } = req.body;
    if (!type || !name) { res.status(400).json({ error: "type and name are required" }); return; }

    const serverConfig = { hostname: server.hostname, port: Number(server.port || 2087), username: server.username, apiToken: server.apiToken || "" };
    await cpanelAddDnsRecord(serverConfig, service.username, service.domain, { type, name, address, cname, exchange, txtdata, ttl: ttl || 14400, preference });
    res.json({ success: true, message: "DNS record added" });
  } catch (err: any) {
    console.error("[DNS] add error:", err.message);
    res.status(500).json({ error: "Failed to add DNS record", message: err.message });
  }
});

// PUT /hosting/:id/dns/:line — edit DNS record
router.put("/hosting/:id/dns/:line", authenticate, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user!.role === "admin";
    const { service, server } = await getServiceAndServer(req.params.id, req.user!.userId, isAdmin);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    if (!server || !service.username || !service.domain) {
      res.status(400).json({ error: "Server not configured" }); return;
    }

    const line = parseInt(req.params.line);
    if (isNaN(line)) { res.status(400).json({ error: "Invalid line number" }); return; }

    const { type, name, address, cname, exchange, txtdata, ttl, preference } = req.body;
    const serverConfig = { hostname: server.hostname, port: Number(server.port || 2087), username: server.username, apiToken: server.apiToken || "" };
    await cpanelEditDnsRecord(serverConfig, service.username, service.domain, line, { type, name, address, cname, exchange, txtdata, ttl: ttl || 14400, preference });
    res.json({ success: true, message: "DNS record updated" });
  } catch (err: any) {
    console.error("[DNS] edit error:", err.message);
    res.status(500).json({ error: "Failed to update DNS record", message: err.message });
  }
});

// DELETE /hosting/:id/dns/:line — delete DNS record
router.delete("/hosting/:id/dns/:line", authenticate, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user!.role === "admin";
    const { service, server } = await getServiceAndServer(req.params.id, req.user!.userId, isAdmin);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    if (!server || !service.username || !service.domain) {
      res.status(400).json({ error: "Server not configured" }); return;
    }

    const line = parseInt(req.params.line);
    if (isNaN(line)) { res.status(400).json({ error: "Invalid line number" }); return; }

    const serverConfig = { hostname: server.hostname, port: Number(server.port || 2087), username: server.username, apiToken: server.apiToken || "" };
    await cpanelDeleteDnsRecord(serverConfig, service.username, service.domain, line);
    res.json({ success: true, message: "DNS record deleted" });
  } catch (err: any) {
    console.error("[DNS] delete error:", err.message);
    res.status(500).json({ error: "Failed to delete DNS record", message: err.message });
  }
});

export default router;
