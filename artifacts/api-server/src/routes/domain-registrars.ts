/**
 * Noehost Domain Registrar Management API
 * Supports: Namecheap, LogicBoxes, ResellerClub, Custom API, None (email-only)
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { domainRegistrarsTable, domainsTable, ordersTable, invoicesTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

// ── Config field definitions per registrar type ───────────────────────────────
export const REGISTRAR_FIELDS: Record<string, { key: string; label: string; type: string; required?: boolean; description?: string }[]> = {
  namecheap: [
    { key: "apiUser",   label: "API Username",   type: "text",     required: true,  description: "Your Namecheap username" },
    { key: "apiKey",    label: "API Key",         type: "password", required: true,  description: "Namecheap API key from profile" },
    { key: "username",  label: "Reseller Username", type: "text",  required: true  },
    { key: "clientIp",  label: "Whitelisted IP",  type: "text",     required: true,  description: "IP that is whitelisted in Namecheap account" },
    { key: "sandbox",   label: "Sandbox Mode",    type: "checkbox", required: false, description: "Use Namecheap test sandbox" },
  ],
  logicboxes: [
    { key: "authId",    label: "Auth-ID (Reseller ID)", type: "text",     required: true },
    { key: "apiKey",    label: "API Key",               type: "password", required: true },
    { key: "testMode",  label: "Test Mode",             type: "checkbox", required: false, description: "Use LogicBoxes test environment" },
  ],
  resellerclub: [
    { key: "authId",    label: "Auth-ID",  type: "text",     required: true },
    { key: "apiKey",    label: "API Key",  type: "password", required: true },
    { key: "testMode",  label: "Test Mode", type: "checkbox", required: false },
  ],
  enom: [
    { key: "username",  label: "eNom Username", type: "text",     required: true },
    { key: "password",  label: "eNom Password", type: "password", required: true },
    { key: "sandbox",   label: "Sandbox Mode",  type: "checkbox", required: false },
  ],
  opensrs: [
    { key: "username",  label: "Reseller Username", type: "text",     required: true },
    { key: "apiKey",    label: "API Key",            type: "password", required: true },
    { key: "sandbox",   label: "Sandbox Mode",       type: "checkbox", required: false },
  ],
  custom: [
    { key: "apiUrl",    label: "API Base URL",      type: "text",     required: true,  description: "Base URL of your custom registrar API" },
    { key: "apiKey",    label: "API Key",            type: "password", required: true  },
    { key: "authHeader",label: "Auth Header Name",  type: "text",     required: false, description: "e.g. X-API-Key, Authorization" },
    { key: "username",  label: "Username",           type: "text",     required: false },
    { key: "password",  label: "Password",           type: "password", required: false },
    { key: "extraJson", label: "Extra Config (JSON)",type: "textarea", required: false, description: "Additional key-value pairs as JSON" },
  ],
  none: [],
};

// ── Registrar API stubs ───────────────────────────────────────────────────────
// In production these would call the actual registrar APIs.
// For now: Namecheap & LogicBoxes have real API structures; Custom makes a webhook call.

async function callRegistrarApi(
  type: string,
  action: "register" | "updateNs" | "lock" | "unlock" | "getEpp" | "check",
  config: Record<string, string>,
  params: Record<string, any>,
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    if (type === "none") {
      return { success: true, result: { message: "Email notification queued — manual processing required." } };
    }

    if (type === "namecheap") {
      const base = config.sandbox === "true"
        ? "https://api.sandbox.namecheap.com/xml.response"
        : "https://api.namecheap.com/xml.response";

      const cmdMap: Record<string, string> = {
        register:  "namecheap.domains.create",
        updateNs:  "namecheap.domains.dns.setCustom",
        lock:      "namecheap.domains.setRegistrarLock",
        unlock:    "namecheap.domains.setRegistrarLock",
        getEpp:    "namecheap.domains.getInfo",
        check:     "namecheap.domains.check",
      };

      const qp = new URLSearchParams({
        ApiUser:   config.apiUser,
        ApiKey:    config.apiKey,
        UserName:  config.username,
        ClientIp:  config.clientIp,
        Command:   cmdMap[action],
        ...params,
      });

      const res = await fetch(`${base}?${qp.toString()}`, { method: "GET" });
      const text = await res.text();
      const ok = text.includes('Status="OK"');
      return { success: ok, result: text, error: ok ? undefined : "API returned non-OK status" };
    }

    if (type === "logicboxes" || type === "resellerclub") {
      const base = config.testMode === "true"
        ? "https://test.httpapi.com/api"
        : "https://httpapi.com/api";

      const endpoints: Record<string, string> = {
        register: "/domains/register.json",
        updateNs: "/domains/modify-ns.json",
        lock:     "/domains/modify.json",
        unlock:   "/domains/modify.json",
        getEpp:   "/domains/details-by-name.json",
        check:    "/domains/available.json",
      };

      const url = `${base}${endpoints[action]}?auth-userid=${config.authId}&api-key=${config.apiKey}&${new URLSearchParams(params).toString()}`;
      const res = await fetch(url);
      const data = await res.json();
      return { success: res.ok, result: data, error: res.ok ? undefined : data.message || "API error" };
    }

    if (type === "custom") {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const authHeader = config.authHeader || "Authorization";
      headers[authHeader] = config.apiKey;
      const res = await fetch(`${config.apiUrl}/${action}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ username: config.username, password: config.password, ...params }),
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok, result: data, error: res.ok ? undefined : data.error || "Custom API error" };
    }

    return { success: false, error: `Unsupported registrar type: ${type}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// List all registrars
router.get("/admin/domain-registrars", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const list = await db.select().from(domainRegistrarsTable).orderBy(domainRegistrarsTable.createdAt);
    res.json(list.map(r => ({
      ...r,
      config: JSON.parse(r.config ?? "{}"),
      fields: REGISTRAR_FIELDS[r.type] ?? [],
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get field definitions for a registrar type
router.get("/admin/domain-registrars/fields/:type", authenticate, requireAdmin, (req: Request, res: Response) => {
  const fields = REGISTRAR_FIELDS[req.params.type] ?? [];
  res.json({ fields });
});

// Create registrar
router.post("/admin/domain-registrars", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, type, description, config, isDefault } = req.body as {
      name: string; type: string; description?: string;
      config: Record<string, string>; isDefault?: boolean;
    };

    if (!name || !type) { res.status(400).json({ error: "Name and type are required" }); return; }

    // If setting as default, clear other defaults
    if (isDefault) {
      await db.update(domainRegistrarsTable).set({ isDefault: false });
    }

    const [r] = await db.insert(domainRegistrarsTable).values({
      name,
      type: type as any,
      description: description ?? "",
      config: JSON.stringify(config ?? {}),
      isActive: true,
      isDefault: isDefault ?? false,
    }).returning();

    res.json({ ...r, config: JSON.parse(r.config), fields: REGISTRAR_FIELDS[r.type] ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update registrar config
router.put("/admin/domain-registrars/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, config, isActive, isDefault } = req.body;

    if (isDefault) {
      await db.update(domainRegistrarsTable).set({ isDefault: false });
    }

    const [r] = await db.update(domainRegistrarsTable)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(config !== undefined && { config: JSON.stringify(config) }),
        ...(isActive !== undefined && { isActive }),
        ...(isDefault !== undefined && { isDefault }),
        updatedAt: new Date(),
      })
      .where(eq(domainRegistrarsTable.id, req.params.id))
      .returning();

    if (!r) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...r, config: JSON.parse(r.config), fields: REGISTRAR_FIELDS[r.type] ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle active
router.post("/admin/domain-registrars/:id/toggle", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const [cur] = await db.select().from(domainRegistrarsTable).where(eq(domainRegistrarsTable.id, req.params.id));
    if (!cur) { res.status(404).json({ error: "Not found" }); return; }
    const [r] = await db.update(domainRegistrarsTable)
      .set({ isActive: !cur.isActive, updatedAt: new Date() })
      .where(eq(domainRegistrarsTable.id, req.params.id))
      .returning();
    res.json({ isActive: r.isActive });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test connection
router.post("/admin/domain-registrars/:id/test", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const [r] = await db.select().from(domainRegistrarsTable).where(eq(domainRegistrarsTable.id, req.params.id));
    if (!r) { res.status(404).json({ error: "Not found" }); return; }

    const config = JSON.parse(r.config ?? "{}");

    let testResult: { success: boolean; result?: any; error?: string };
    if (r.type === "none") {
      testResult = { success: true, result: { message: "Email-only mode — no API connection required." } };
    } else {
      testResult = await callRegistrarApi(r.type, "check", config, { "domain-name": "noehost.com" });
    }

    const resultText = testResult.success
      ? "Connection successful"
      : `Failed: ${testResult.error ?? "Unknown error"}`;

    await db.update(domainRegistrarsTable)
      .set({ lastTestedAt: new Date(), lastTestResult: resultText, updatedAt: new Date() })
      .where(eq(domainRegistrarsTable.id, req.params.id));

    res.json({ success: testResult.success, message: resultText, detail: testResult.result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete registrar
router.delete("/admin/domain-registrars/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    await db.delete(domainRegistrarsTable).where(eq(domainRegistrarsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Domain action via registrar ───────────────────────────────────────────────
// POST /admin/domain-registrars/:registrarId/action/:domainId
router.post("/admin/domain-registrars/:registrarId/action/:domainId",
  authenticate, requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { action } = req.body as { action: "updateNs" | "lock" | "unlock" | "getEpp" };
      const [registrar] = await db.select().from(domainRegistrarsTable)
        .where(eq(domainRegistrarsTable.id, req.params.registrarId));
      if (!registrar) { res.status(404).json({ error: "Registrar not found" }); return; }

      const [domain] = await db.select().from(domainsTable)
        .where(eq(domainsTable.id, req.params.domainId));
      if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }

      const config = JSON.parse(registrar.config ?? "{}");
      const params: Record<string, any> = {
        domainName: domain.name + domain.tld,
        nameservers: (domain.nameservers ?? ["ns1.noehost.com", "ns2.noehost.com"]).join(","),
      };

      const result = await callRegistrarApi(registrar.type, action, config, params);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── Activate domain order with registrar ─────────────────────────────────────
// This augments the existing activate-domain flow with registrar API call
router.post("/admin/orders/:id/activate-domain-registrar", authenticate, requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { registrarId, period = 1 } = req.body as { registrarId?: string; period?: number };

      const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, req.params.id)).limit(1);
      if (!order) { res.status(404).json({ error: "Order not found" }); return; }
      if (order.type !== "domain") { res.status(400).json({ error: "Not a domain order" }); return; }

      const fullDomain = order.domain || order.itemName || "";
      const dotIdx = fullDomain.indexOf(".");
      const domainName = dotIdx > 0 ? fullDomain.substring(0, dotIdx) : fullDomain;
      const tld = dotIdx > 0 ? fullDomain.substring(dotIdx) : ".com";

      // Get registrar details (optional — may be "none" or omitted)
      let registrarName = "manual";
      let apiCallResult: any = null;

      if (registrarId && registrarId !== "none") {
        const [reg] = await db.select().from(domainRegistrarsTable)
          .where(eq(domainRegistrarsTable.id, registrarId));
        if (reg) {
          registrarName = reg.name;
          const config = JSON.parse(reg.config ?? "{}");
          const nsArr = ["ns1.noehost.com", "ns2.noehost.com"];
          apiCallResult = await callRegistrarApi(reg.type, "register", config, {
            domainName: fullDomain,
            years: String(period),
            nameservers: nsArr.join(","),
            ns1: nsArr[0], ns2: nsArr[1],
          });
        }
      }

      // Create / update domain record
      const existing = await db.select().from(domainsTable)
        .where(eq(domainsTable.clientId, order.clientId));
      const found = existing.find(d => d.name === domainName && d.tld === tld);

      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + (period || 1));

      let domain;
      if (found) {
        [domain] = await db.update(domainsTable)
          .set({
            status: "active",
            registrar: registrarName,
            expiryDate,
            nextDueDate: expiryDate,
            nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
            updatedAt: new Date(),
          })
          .where(eq(domainsTable.id, found.id))
          .returning();
      } else {
        [domain] = await db.insert(domainsTable).values({
          clientId: order.clientId,
          name: domainName,
          tld,
          status: "active",
          registrar: registrarName,
          registrationDate: new Date(),
          expiryDate,
          nextDueDate: expiryDate,
          nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
          lockStatus: "locked",
        }).returning();
      }

      // Mark order active
      await db.update(ordersTable)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(ordersTable.id, req.params.id));

      // Mark invoice paid if exists
      if (order.invoiceId) {
        await db.update(invoicesTable)
          .set({ status: "paid", paidAt: new Date() } as any)
          .where(eq(invoicesTable.id, order.invoiceId));
      }

      res.json({
        domain: { id: domain.id, name: domain.name, tld: domain.tld, status: domain.status },
        registrar: registrarName,
        apiCallResult,
        message: apiCallResult?.success === false
          ? `Domain record created but registrar API call failed: ${apiCallResult.error}. Please register manually.`
          : `Domain ${fullDomain} activated successfully via ${registrarName}.`,
      });
    } catch (err: any) {
      console.error("[DOMAIN-REGISTRAR] activate error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
