/**
 * POST /api/20i/test
 * Simple 20i connection tester — as per spec:
 * - Auth: Bearer <raw_api_key>  (no Base64)
 * - Tests: https://api.20i.com/reseller/v1/reseller then https://api.20i.com/reseller
 * - Returns detailed debug output for diagnosing 401/403/network errors
 */
import { Router } from "express";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { db } from "@workspace/db";
import { uploadedModulesTable, serversTable } from "@workspace/db/schema";
import { ilike, eq, and } from "drizzle-orm";

const router = Router();

interface TestResult {
  success: boolean;
  url: string;
  httpStatus: number | null;
  requestHeaders: Record<string, string>;
  responseBody: string;
  errorType: "none" | "invalid_api_key" | "ip_not_whitelisted" | "network_error" | "unknown";
  errorMessage: string;
  durationMs: number;
}

async function tryEndpoint(apiKey: string, url: string): Promise<TestResult> {
  const requestHeaders = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const start = Date.now();
  try {
    console.log(`[20i-TEST] → GET ${url}`);
    console.log(`[20i-TEST]   Authorization: Bearer ****${apiKey.slice(-6)}`);
    console.log(`[20i-TEST]   Content-Type: application/json`);

    const res = await fetch(url, {
      method: "GET",
      headers: requestHeaders,
      signal: AbortSignal.timeout(20000),
    });

    const durationMs = Date.now() - start;
    const bodyText = await res.text().catch(() => "");

    console.log(`[20i-TEST] ← HTTP ${res.status} in ${durationMs}ms`);
    console.log(`[20i-TEST]   Response body: ${bodyText.substring(0, 500)}`);

    if (res.ok) {
      return {
        success: true,
        url,
        httpStatus: res.status,
        requestHeaders: { ...requestHeaders, Authorization: `Bearer ****${apiKey.slice(-6)}` },
        responseBody: bodyText.substring(0, 1000),
        errorType: "none",
        errorMessage: "",
        durationMs,
      };
    }

    let errorType: TestResult["errorType"] = "unknown";
    let errorMessage = "";

    if (res.status === 401) {
      errorType = "ip_not_whitelisted";
      errorMessage = "401 Unauthorized — IP may not be whitelisted, or API key is invalid. Raw: " + bodyText.substring(0, 200);
    } else if (res.status === 403) {
      errorType = "invalid_api_key";
      errorMessage = "403 Forbidden — API key lacks permission. Raw: " + bodyText.substring(0, 200);
    } else {
      errorMessage = `HTTP ${res.status}: ${bodyText.substring(0, 200)}`;
    }

    return {
      success: false,
      url,
      httpStatus: res.status,
      requestHeaders: { ...requestHeaders, Authorization: `Bearer ****${apiKey.slice(-6)}` },
      responseBody: bodyText.substring(0, 1000),
      errorType,
      errorMessage,
      durationMs,
    };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.error(`[20i-TEST] Network error: ${err.message}`);
    return {
      success: false,
      url,
      httpStatus: null,
      requestHeaders: { ...requestHeaders, Authorization: `Bearer ****${apiKey.slice(-6)}` },
      responseBody: "",
      errorType: "network_error",
      errorMessage: `Network error: ${err.message}`,
      durationMs,
    };
  }
}

/** Resolve the 20i API key from: (1) request body, (2) module config, (3) server record */
async function resolveApiKey(bodyKey?: string): Promise<{ key: string; source: string } | null> {
  // Priority 1: Explicitly supplied in request body
  if (bodyKey && bodyKey.trim().length >= 10) {
    return { key: bodyKey.trim(), source: "request_body" };
  }

  // Priority 2: Uploaded "20i Reseller" module config
  try {
    const [mod] = await db.select().from(uploadedModulesTable).where(ilike(uploadedModulesTable.name, "%20i%")).limit(1);
    if (mod) {
      const cfg = typeof mod.config === "string" ? JSON.parse(mod.config) : (mod.config as Record<string, string>);
      const k = (cfg?.api_key ?? "").trim();
      if (k.length >= 10) return { key: k, source: `module:${mod.name}` };
    }
  } catch { /* fall through */ }

  // Priority 3: Active 20i server record
  try {
    const [server] = await db.select().from(serversTable)
      .where(and(eq(serversTable.type, "20i"), eq(serversTable.status, "active"))).limit(1);
    if (server?.apiToken && server.apiToken.length >= 10) {
      return { key: server.apiToken.trim(), source: `server:${server.name}` };
    }
  } catch { /* fall through */ }

  return null;
}

/**
 * POST /api/20i/test
 * Body: { apiKey?: string }  ← optional; auto-resolved from module/server if omitted
 * Tests the 20i API connection and returns full debug info.
 */
router.post("/20i/test", authenticate, requireAdmin, async (req: any, res) => {
  const { apiKey } = req.body as { apiKey?: string };

  const resolved = await resolveApiKey(apiKey);
  if (!resolved) {
    res.status(400).json({
      success: false,
      error: "No 20i API key found. Enter one in Admin → Modules (20i Reseller) or Admin → Servers.",
    });
    return;
  }

  const cleanKey = resolved.key.replace(/[\u200B-\u200D\uFEFF\u00AD\u0000-\u001F\u007F]/g, "");

  console.log("[20i-TEST] ============================================================");
  console.log(`[20i-TEST] Starting connection test | key_len=${cleanKey.length} last6=****${cleanKey.slice(-6)}`);
  console.log(`[20i-TEST] Auth format: Bearer <raw_key>  (no Base64)`);

  // Try /reseller/v1/reseller first (as per spec), then /reseller as fallback
  const urlsToTry = [
    "https://api.20i.com/reseller/v1/reseller",
    "https://api.20i.com/reseller",
  ];

  const results: TestResult[] = [];

  for (const url of urlsToTry) {
    const result = await tryEndpoint(cleanKey, url);
    results.push(result);
    if (result.success) {
      console.log(`[20i-TEST] ✓ SUCCESS at ${url}`);
      break;
    }
    if (result.httpStatus === 401 || result.httpStatus === 403) {
      // Auth errors are the same for all endpoints — no point trying others
      console.log("[20i-TEST] Auth error — stopping further attempts");
      break;
    }
  }

  console.log("[20i-TEST] ============================================================");

  const passing = results.find(r => r.success);
  if (passing) {
    res.json({
      success: true,
      message: "Connected to 20i API successfully",
      keySource: resolved.source,
      workingUrl: passing.url,
      httpStatus: passing.httpStatus,
      responseBody: passing.responseBody,
      attempts: results,
    });
    return;
  }

  const last = results[results.length - 1];
  let userMessage = last.errorMessage;
  if (last.httpStatus === 401) {
    userMessage = "Authentication failed (401). IP 35.229.81.149 must be whitelisted at my.20i.com → Reseller API → IP Whitelist, or the API key is invalid.";
  } else if (last.httpStatus === 403) {
    userMessage = "Permission denied (403). Ensure the API key is a Reseller-level Combined key.";
  } else if (last.errorType === "network_error") {
    userMessage = "Network error — could not reach api.20i.com. Check for proxy/firewall issues.";
  }

  res.json({
    success: false,
    message: userMessage,
    keySource: resolved.source,
    httpStatus: last.httpStatus,
    attempts: results,
    outboundIp: "35.229.81.149",
  });
});

export default router;
