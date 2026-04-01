/**
 * 20i Module — Utility helpers
 */
import type { APIResponse } from "./20i.types.js";

// ─── API key validation ───────────────────────────────────────────────────────

/**
 * Strip invisible/zero-width chars from an API key and validate minimum length.
 * These hidden chars silently break Bearer token auth.
 */
export function validateApiKey(apiKey: unknown): { valid: boolean; clean: string; error?: string } {
  if (typeof apiKey !== "string" || !apiKey) {
    return { valid: false, clean: "", error: "API key is required" };
  }
  const clean = apiKey.trim().replace(/[\u200B-\u200D\uFEFF\u00AD\u0000-\u001F\u007F]/g, "");
  if (clean.length < 8) {
    return { valid: false, clean, error: `API key too short (${clean.length} chars) — minimum 8 characters` };
  }
  console.log(`[20i] API key validated — len=${clean.length}  first4=${clean.substring(0, 4)}  last4=${clean.slice(-4)}`);
  return { valid: true, clean };
}

// ─── Error classification ─────────────────────────────────────────────────────

export type TwentyIErrorType = APIResponse["errorType"];

export function classifyError(err: any): { message: string; errorType: TwentyIErrorType; httpStatus?: number } {
  const status: number | undefined = err?.response?.status ?? err?.status ?? undefined;
  const rawBody = err?.response?.data ?? err?.body ?? "";
  const rawMsg: string = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
  const errMsg: string = err?.message ?? String(err ?? "Unknown error");

  console.error(`[20i] Error: status=${status ?? "none"}  msg=${errMsg}  raw=${rawMsg.substring(0, 200)}`);

  if (status === 401) {
    return {
      message: "IP Not Whitelisted (401 Unauthorized). Add this server's IP to my.20i.com → Reseller API → IP Whitelist.",
      errorType: "ip_not_whitelisted",
      httpStatus: 401,
    };
  }
  if (status === 403) {
    return {
      message: "Invalid API Key (403 Forbidden). Ensure you are using a Reseller-level Combined API key.",
      errorType: "invalid_api_key",
      httpStatus: 403,
    };
  }
  if (status === 404) {
    return { message: `Endpoint not found (404): ${errMsg}`, errorType: "not_found", httpStatus: 404 };
  }
  if (status === 429) {
    return { message: "Rate limited (429) — please wait before retrying.", errorType: "rate_limited", httpStatus: 429 };
  }
  if (status && status >= 500) {
    return { message: `20i Server Error (${status}): ${rawMsg.substring(0, 200)}`, errorType: "server_error", httpStatus: status };
  }
  if (errMsg.toLowerCase().includes("network") || errMsg.toLowerCase().includes("enotfound") || errMsg.toLowerCase().includes("timeout")) {
    return { message: `Network error: ${errMsg}`, errorType: "network_error" };
  }
  return { message: errMsg || rawMsg.substring(0, 200) || "Unknown error", errorType: "unknown", httpStatus: status };
}

// ─── Response formatters ──────────────────────────────────────────────────────

export function formatResponse<T>(data: T, message = "Success"): APIResponse<T> {
  return { success: true, message, data };
}

export function formatError(err: any, fallbackMessage?: string): APIResponse<never> {
  const { message, errorType, httpStatus } = classifyError(err);
  return {
    success: false,
    message: fallbackMessage ?? message,
    error: message,
    errorType,
    httpStatus,
  };
}

// ─── Standard error handler ───────────────────────────────────────────────────

/**
 * Wraps an Express route handler — catches errors and returns a structured JSON response.
 */
export function handleError(res: any, err: any, fallbackMessage?: string): void {
  const { message, errorType, httpStatus } = classifyError(err);
  const statusCode = httpStatus && httpStatus >= 400 ? httpStatus : 500;

  console.error(`[20i] handleError → ${statusCode}  ${message}`);

  res.status(statusCode).json({
    success: false,
    message: fallbackMessage ?? message,
    error: message,
    errorType,
    httpStatus: statusCode,
  } satisfies APIResponse<never>);
}
