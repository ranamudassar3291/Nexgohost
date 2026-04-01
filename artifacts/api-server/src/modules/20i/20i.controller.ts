/**
 * 20i Module — Controller layer
 * Express request handlers that call the service layer and return HTTP responses.
 */
import type { Request, Response } from "express";
import {
  testConnection,
  addServer,
  createAccount,
  suspendAccount,
  unsuspendAccount,
  terminateAccount,
  changePackage,
  singleSignOn,
  getPackages,
  getAccounts,
} from "./20i.service.js";
import { handleError } from "./20i.utils.js";
import { db } from "@workspace/db";
import { serversTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sanitiseKey } from "../../lib/twenty-i.js";

// ─── Helper: get API key from DB by server id (or body) ───────────────────────

async function resolveApiKey(req: Request): Promise<string | null> {
  // Accept key directly in body
  if (req.body?.apiKey) return req.body.apiKey as string;

  // Or look up by serverId
  const serverId = req.body?.serverId ?? req.params?.serverId;
  if (serverId) {
    const [server] = await db.select().from(serversTable).where(eq(serversTable.id, serverId));
    return server?.apiToken ?? null;
  }
  return null;
}

// ─── testConnection ───────────────────────────────────────────────────────────

/**
 * POST /api/20i/test
 * Body: { apiKey: string } | { serverId: string }
 */
export async function handleTestConnection(req: Request, res: Response): Promise<void> {
  try {
    const apiKey = await resolveApiKey(req);
    if (!apiKey) {
      res.status(400).json({ success: false, message: "apiKey or serverId is required" });
      return;
    }

    const result = await testConnection(apiKey);

    if (result.success) {
      res.json({ ...result, message: "Connected Successfully" });
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    handleError(res, err, "Connection test failed");
  }
}

// ─── addServer ────────────────────────────────────────────────────────────────

/**
 * POST /api/20i/add-server
 * Body: { name: string, apiKey: string }
 *
 * Flow:
 *   Step 1 — User provides API key
 *   Step 2 — Test connection
 *   Step 3 — Save server to DB
 *   Step 4 — Return success
 */
export async function handleAddServer(req: Request, res: Response): Promise<void> {
  try {
    const { name, apiKey, ns1, ns2, isDefault = false } = req.body;

    // Step 1: Validate inputs
    if (!name?.trim()) {
      res.status(400).json({ success: false, message: "Server name is required" });
      return;
    }
    if (!apiKey) {
      res.status(400).json({ success: false, message: "apiKey is required" });
      return;
    }

    // Step 2: Test connection
    console.log(`[20i] Add Server — Step 2: Testing API key…`);
    const testResult = await addServer({ name, apiKey });

    if (!testResult.success) {
      let httpStatus = 400;
      if (testResult.errorType === "ip_not_whitelisted") httpStatus = 401;
      if (testResult.errorType === "invalid_api_key") httpStatus = 403;

      res.status(httpStatus).json({
        success: false,
        message: testResult.message,
        errorType: testResult.errorType,
        hint: testResult.errorType === "ip_not_whitelisted"
          ? "Add this server's outbound IP to my.20i.com → Reseller API → IP Whitelist"
          : testResult.errorType === "invalid_api_key"
          ? "Get a Combined key at my.20i.com → Reseller API → API Key"
          : undefined,
      });
      return;
    }

    // Step 3: Save to DB
    console.log(`[20i] Add Server — Step 3: Saving to database…`);
    const cleanKey = sanitiseKey(apiKey);
    if (isDefault) await db.update(serversTable).set({ isDefault: false });
    const [record] = await db.insert(serversTable).values({
      name: name.trim(),
      hostname: "api.20i.com",
      type: "20i",
      apiToken: cleanKey,
      apiUsername: null,
      apiPort: null,
      ns1: ns1 ?? null,
      ns2: ns2 ?? null,
      maxAccounts: 500,
      isDefault,
      status: "active",
    }).returning();

    // Step 4: Return success
    console.log(`[20i] Add Server — Step 4: ✓ Server saved id=${record.id}`);
    res.status(201).json({
      success: true,
      message: "20i Server Connected",
      serverId: record.id,
      name: record.name,
      packageCount: testResult.data?.packageCount ?? 0,
    });
  } catch (err) {
    handleError(res, err, "Failed to add 20i server");
  }
}

// ─── createHosting ────────────────────────────────────────────────────────────

/**
 * POST /api/20i/create
 * Body: { apiKey, domain, email, packageId?, stackUserId? }
 */
export async function handleCreateHosting(req: Request, res: Response): Promise<void> {
  try {
    const apiKey = await resolveApiKey(req);
    if (!apiKey) { res.status(400).json({ success: false, message: "apiKey or serverId is required" }); return; }

    const { domain, email, packageId, stackUserId } = req.body;
    if (!domain) { res.status(400).json({ success: false, message: "domain is required" }); return; }
    if (!email) { res.status(400).json({ success: false, message: "email is required" }); return; }

    const result = await createAccount(apiKey, { domain, email, packageId, stackUserId });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    handleError(res, err, "Failed to create hosting account");
  }
}

// ─── suspendHosting ───────────────────────────────────────────────────────────

/**
 * POST /api/20i/suspend
 * Body: { apiKey, siteId }
 */
export async function handleSuspendHosting(req: Request, res: Response): Promise<void> {
  try {
    const apiKey = await resolveApiKey(req);
    if (!apiKey) { res.status(400).json({ success: false, message: "apiKey or serverId is required" }); return; }

    const { siteId } = req.body;
    if (!siteId) { res.status(400).json({ success: false, message: "siteId is required" }); return; }

    const result = await suspendAccount(apiKey, siteId);
    res.json(result);
  } catch (err) {
    handleError(res, err, "Failed to suspend account");
  }
}

// ─── unsuspendHosting ─────────────────────────────────────────────────────────

/**
 * POST /api/20i/unsuspend
 * Body: { apiKey, siteId }
 */
export async function handleUnsuspendHosting(req: Request, res: Response): Promise<void> {
  try {
    const apiKey = await resolveApiKey(req);
    if (!apiKey) { res.status(400).json({ success: false, message: "apiKey or serverId is required" }); return; }

    const { siteId } = req.body;
    if (!siteId) { res.status(400).json({ success: false, message: "siteId is required" }); return; }

    const result = await unsuspendAccount(apiKey, siteId);
    res.json(result);
  } catch (err) {
    handleError(res, err, "Failed to unsuspend account");
  }
}

// ─── terminateHosting ─────────────────────────────────────────────────────────

/**
 * POST /api/20i/terminate
 * Body: { apiKey, siteId }
 */
export async function handleTerminateHosting(req: Request, res: Response): Promise<void> {
  try {
    const apiKey = await resolveApiKey(req);
    if (!apiKey) { res.status(400).json({ success: false, message: "apiKey or serverId is required" }); return; }

    const { siteId } = req.body;
    if (!siteId) { res.status(400).json({ success: false, message: "siteId is required" }); return; }

    const result = await terminateAccount(apiKey, siteId);
    res.json(result);
  } catch (err) {
    handleError(res, err, "Failed to terminate account");
  }
}

// ─── changePackage ────────────────────────────────────────────────────────────

/**
 * POST /api/20i/change-package
 * Body: { apiKey, siteId, packageId }
 */
export async function handleChangePackage(req: Request, res: Response): Promise<void> {
  try {
    const apiKey = await resolveApiKey(req);
    if (!apiKey) { res.status(400).json({ success: false, message: "apiKey or serverId is required" }); return; }

    const { siteId, packageId } = req.body;
    if (!siteId) { res.status(400).json({ success: false, message: "siteId is required" }); return; }
    if (!packageId) { res.status(400).json({ success: false, message: "packageId is required" }); return; }

    const result = await changePackage(apiKey, siteId, packageId);
    res.json(result);
  } catch (err) {
    handleError(res, err, "Failed to change package");
  }
}

// ─── singleSignOn ─────────────────────────────────────────────────────────────

/**
 * GET /api/20i/sso/:siteId
 * Query: ?apiKey=xxx  OR body: { apiKey }
 */
export async function handleSingleSignOn(req: Request, res: Response): Promise<void> {
  try {
    const apiKey = (req.query?.apiKey as string) ?? req.body?.apiKey ?? await resolveApiKey(req);
    if (!apiKey) { res.status(400).json({ success: false, message: "apiKey is required" }); return; }

    const siteId = req.params.siteId ?? req.body?.siteId;
    if (!siteId) { res.status(400).json({ success: false, message: "siteId is required" }); return; }

    const result = await singleSignOn(apiKey, siteId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    handleError(res, err, "Failed to generate SSO URL");
  }
}

// ─── getPackages ──────────────────────────────────────────────────────────────

/**
 * GET /api/20i/packages
 * Query: ?apiKey=xxx  OR body: { apiKey }
 */
export async function handleGetPackages(req: Request, res: Response): Promise<void> {
  try {
    const apiKey = (req.query?.apiKey as string) ?? req.body?.apiKey ?? await resolveApiKey(req);
    if (!apiKey) { res.status(400).json({ success: false, message: "apiKey or serverId is required" }); return; }

    const result = await getPackages(apiKey);
    res.json(result);
  } catch (err) {
    handleError(res, err, "Failed to get packages");
  }
}

// ─── getAccounts ──────────────────────────────────────────────────────────────

/**
 * GET /api/20i/accounts
 * Query: ?apiKey=xxx  OR body: { apiKey }
 */
export async function handleGetAccounts(req: Request, res: Response): Promise<void> {
  try {
    const apiKey = (req.query?.apiKey as string) ?? req.body?.apiKey ?? await resolveApiKey(req);
    if (!apiKey) { res.status(400).json({ success: false, message: "apiKey or serverId is required" }); return; }

    const result = await getAccounts(apiKey);
    res.json(result);
  } catch (err) {
    handleError(res, err, "Failed to get accounts");
  }
}
