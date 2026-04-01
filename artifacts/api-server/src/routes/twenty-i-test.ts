/**
 * POST /api/20i/test
 * Comprehensive 20i API tester with real outbound IP detection.
 * Uses axios (not fetch) for maximum compatibility.
 * - Auth: Bearer <raw_api_key>  (no Base64)
 * - Tests: https://api.20i.com/reseller
 * - Detects real outgoing IP from ipify.org + ifconfig.me before every test
 */
import { Router } from "express";
import axios, { AxiosRequestConfig } from "axios";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { db } from "@workspace/db";
import { uploadedModulesTable, serversTable } from "@workspace/db/schema";
import { ilike, eq, and } from "drizzle-orm";
import { sanitiseKey } from "../lib/twenty-i.js";

const router = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttemptResult {
  success: boolean;
  url: string;
  httpStatus: number | null;
  responseBody: string;
  errorType: "none" | "ip_not_whitelisted" | "invalid_api_key" | "network_error" | "unknown";
  errorMessage: string;
  durationMs: number;
}

interface IpInfo {
  primary: string | null;
  secondary: string | null;
}

// ─── IP Detection (axios) ─────────────────────────────────────────────────────

async function fetchIp(url: string): Promise<string | null> {
  try {
    const res = await axios.get(url, { timeout: 8000 });
    if (typeof res.data === "object" && res.data?.ip) return String(res.data.ip);
    const text = String(res.data ?? "").trim();
    return /^[\d.:a-fA-F]+$/.test(text) ? text : null;
  } catch {
    return null;
  }
}

async function detectOutboundIp(): Promise<IpInfo> {
  const [primary, secondary] = await Promise.all([
    fetchIp("https://api.ipify.org?format=json"),
    fetchIp("https://ifconfig.me/ip"),
  ]);
  console.log(`[20i-TEST] Outgoing IP:  primary=${primary ?? "failed"}  secondary=${secondary ?? "failed"}`);
  return { primary, secondary };
}

// ─── API Key Resolution ───────────────────────────────────────────────────────

async function resolveApiKey(bodyKey?: string): Promise<{ key: string; source: string } | null> {
  if (bodyKey && bodyKey.trim().length >= 10) {
    return { key: bodyKey.trim(), source: "request_body" };
  }
  try {
    const [mod] = await db.select().from(uploadedModulesTable).where(ilike(uploadedModulesTable.name, "%20i%")).limit(1);
    if (mod) {
      const cfg = typeof mod.config === "string" ? JSON.parse(mod.config) : (mod.config as Record<string, string>);
      const k = (cfg?.api_key ?? "").trim();
      if (k.length >= 10) return { key: k, source: `module:${mod.name}` };
    }
  } catch { /* fall through */ }
  try {
    const [server] = await db.select().from(serversTable)
      .where(and(eq(serversTable.type, "20i"), eq(serversTable.status, "active"))).limit(1);
    if (server?.apiToken && server.apiToken.length >= 10) {
      return { key: server.apiToken.trim(), source: `server:${server.name}` };
    }
  } catch { /* fall through */ }
  return null;
}

// ─── Single endpoint attempt (axios) ─────────────────────────────────────────

async function tryEndpoint(apiKey: string, url: string): Promise<AttemptResult> {
  const start = Date.now();
  try {
    console.log(`[20i-TEST] → GET ${url}`);
    console.log(`[20i-TEST]   Authorization: Bearer ${apiKey.substring(0, 4)}...${apiKey.slice(-4)}  (len=${apiKey.length})`);

    const cfg: AxiosRequestConfig = {
      method: "GET",
      url,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 20000,
      validateStatus: () => true,
    };

    const res = await axios(cfg);
    const durationMs = Date.now() - start;
    const bodyStr = typeof res.data === "string" ? res.data : JSON.stringify(res.data);

    console.log(`[20i-TEST] ← HTTP ${res.status} (${durationMs}ms)  body=${bodyStr.substring(0, 300)}`);

    if (res.status >= 200 && res.status < 300) {
      return { success: true, url, httpStatus: res.status, responseBody: bodyStr.substring(0, 1000), errorType: "none", errorMessage: "", durationMs };
    }

    let errorType: AttemptResult["errorType"] = "unknown";
    let errorMessage = `HTTP ${res.status}: ${bodyStr.substring(0, 200)}`;

    if (res.status === 401) {
      errorType = "ip_not_whitelisted";
      errorMessage = `401 Unauthorized — this server's IP is not whitelisted in 20i, or the API key is invalid. Raw: ${bodyStr.substring(0, 200)}`;
    } else if (res.status === 403) {
      errorType = "invalid_api_key";
      errorMessage = `403 Forbidden — API key lacks Reseller permissions. Raw: ${bodyStr.substring(0, 200)}`;
    }

    return { success: false, url, httpStatus: res.status, responseBody: bodyStr.substring(0, 1000), errorType, errorMessage, durationMs };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.error(`[20i-TEST] Network error: ${err.message}`);
    return { success: false, url, httpStatus: null, responseBody: "", errorType: "network_error", errorMessage: `Network error: ${err.message}`, durationMs };
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post("/20i/test", authenticate, requireAdmin, async (req: any, res) => {
  const { apiKey } = req.body as { apiKey?: string };

  console.log("[20i-TEST] ==============================================================");

  // Detect real outgoing IP + resolve API key in parallel
  const [ipInfo, resolved] = await Promise.all([
    detectOutboundIp(),
    resolveApiKey(apiKey),
  ]);

  if (!resolved) {
    res.status(400).json({
      success: false,
      error: "No 20i API key found. Enter one in Admin → Modules (20i Reseller) or Admin → Servers.",
      outboundIp: ipInfo,
    });
    return;
  }

  const cleanKey = sanitiseKey(resolved.key);

  console.log(`[20i-TEST] KEY: ${cleanKey.substring(0, 4)}...${cleanKey.slice(-4)}  len=${cleanKey.length}`);
  console.log(`[20i-TEST] Source: ${resolved.source}`);
  console.log(`[20i-TEST] Auth format: Bearer <raw_key>  (no Base64)`);

  // Test https://api.20i.com/reseller (canonical endpoint)
  const urlsToTry = ["https://api.20i.com/reseller"];

  const attempts: AttemptResult[] = [];

  for (const url of urlsToTry) {
    const attempt = await tryEndpoint(cleanKey, url);
    attempts.push(attempt);
    if (attempt.success) {
      console.log(`[20i-TEST] ✓ SUCCESS at ${url}`);
      break;
    }
    if (attempt.httpStatus === 401 || attempt.httpStatus === 403) {
      console.log(`[20i-TEST] ✗ Auth error ${attempt.httpStatus} — stopping`);
      break;
    }
  }

  console.log("[20i-TEST] ==============================================================");

  const passing = attempts.find(a => a.success);
  if (passing) {
    res.json({
      success: true,
      message: "Connected to 20i API successfully",
      keySource: resolved.source,
      workingUrl: passing.url,
      httpStatus: passing.httpStatus,
      responseBody: passing.responseBody,
      outboundIp: ipInfo,
      attempts,
    });
    return;
  }

  const last = attempts[attempts.length - 1];
  let message = last.errorMessage;
  let hint = "";

  if (last.httpStatus === 401) {
    const ip = ipInfo.primary ?? ipInfo.secondary ?? "unknown";
    message = `IP not whitelisted (401 Unauthorized). Add this server's IP to my.20i.com → Reseller API → IP Whitelist.`;
    hint = `Whitelist this IP in 20i: ${ip}`;
  } else if (last.httpStatus === 403) {
    message = "API key rejected (403 Forbidden). Use a Reseller-level Combined API key from my.20i.com.";
    hint = "Get a Combined key at my.20i.com → Reseller API → API Key";
  } else if (last.errorType === "network_error") {
    message = "Network error — could not reach api.20i.com.";
  }

  res.json({
    success: false,
    message,
    hint,
    keySource: resolved.source,
    httpStatus: last.httpStatus,
    errorType: last.errorType,
    outboundIp: ipInfo,
    attempts,
  });
});

export default router;
