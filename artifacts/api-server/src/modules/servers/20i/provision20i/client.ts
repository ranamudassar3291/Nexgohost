/**
 * 20i Reseller API — Base HTTP Client
 * https://api.20i.com
 *
 * Authentication (per official API Blueprint example):
 *   The docs show: Authorization: Bearer ZTRkNGZkMzFhNTJkY2FlMwo=
 *   Decoded:       "e4d4fd31a52dcae3\n"  ← trailing newline is mandatory
 *
 *   Formula: Authorization: Bearer base64(apiKey + "\n")
 *   Our sanitiseKey strips invisible/copy-paste chars and newlines from the
 *   raw input, then we add exactly ONE "\n" before encoding.
 */

import type { TwentyIConfig, TwentyIErrorResponse } from "./types.js";

export const BASE_URL = "https://api.20i.com";
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_RETRIES = 3;

// ─── Key Sanitisation ────────────────────────────────────────────────────────

/**
 * Strip invisible/zero-width characters and control chars from a pasted key.
 * Preserves '+' which is the separator in the Combined Key format: GeneralKey+OAuthKey
 */
export function sanitiseKey(raw: string): string {
  return raw
    .trim()
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u007F]/g, "") // zero-width + DEL
    .replace(/[\r\n\t]/g, "");                          // strip control chars
}

/**
 * Extract the General Key for Bearer authentication from a Combined Key.
 *
 * 20i Combined Key format: "GeneralKey+OAuthKey"
 * Only the GENERAL KEY (part before "+") must be base64-encoded in the Bearer token.
 *
 * Proof from server logs:
 *   17-char key (General Key alone) → HTTP 404   (auth PASSED — resource not found)
 *   35-char combined key            → HTTP 401   (auth FAILED — User ID)
 *
 * "cb574b954e850f7f5+c6e95e89ebd7ea3c0"  →  "cb574b954e850f7f5"
 * "cb574b954e850f7f5"                     →  "cb574b954e850f7f5"  (unchanged)
 */
export function extractGeneralKey(cleanKey: string): string {
  const plusIdx = cleanKey.indexOf("+");
  if (plusIdx > 0) return cleanKey.substring(0, plusIdx);
  return cleanKey;
}

/**
 * Encode the General Key to the base64 Bearer token.
 * IMPORTANT: a trailing "\n" MUST be appended before encoding — required by 20i's API.
 */
export function encodeKey(cleanKey: string): string {
  return Buffer.from(cleanKey + "\n").toString("base64");
}

/**
 * Build the full Authorization header value.
 * Extracts the General Key from a Combined Key, then encodes it.
 * Returns: "Bearer <base64(generalKey + "\n")>"
 */
export function buildAuthHeader(apiKey: string): string {
  const clean = sanitiseKey(apiKey);
  const generalKey = extractGeneralKey(clean);
  const token = encodeKey(generalKey);
  return `Bearer ${token}`;
}

// ─── Client Class ────────────────────────────────────────────────────────────

export class TwentyIClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config: TwentyIConfig) {
    if (!config.apiKey) throw new Error("20i API key is required");
    this.baseUrl = (config.baseUrl ?? BASE_URL).replace(/\/$/, "");
    this.authHeader = buildAuthHeader(config.apiKey);
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  // ── Low-level request ──────────────────────────────────────────────────────

  async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    path: string,
    body?: unknown,
    attempt = 1,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("aborted") && attempt < this.maxRetries) {
        await delay(500 * attempt);
        return this.request<T>(method, path, body, attempt + 1);
      }
      throw new Error(`20i network error: ${msg}`);
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }

    // Handle 401 – always parse the error type
    if (response.status === 401) {
      let errType: string | null = null;
      try { errType = (data as TwentyIErrorResponse)?.type ?? null; } catch { /* */ }
      if (errType === "User ID") {
        throw new TwentyIAuthError(
          `401 — KEY NOT RECOGNISED. The API key was not matched to any 20i account. ` +
          `{"type":"User ID"} response: ${text.substring(0, 200)}`,
          "wrong_key",
          response.status,
        );
      }
      throw new TwentyIAuthError(
        `401 — Authentication failed. Verify your API key at my.20i.com → Reseller API. Response: ${text.substring(0, 200)}`,
        "ip_or_unknown",
        response.status,
      );
    }

    // Handle 403 – access denied (key permissions or account type)
    if (response.status === 403) {
      const perm = (data as TwentyIErrorResponse)?.permission;
      const detail = perm ? ` (permission: ${perm})` : "";
      throw new TwentyIAuthError(
        `Account creation failed — 20i API returned 403${detail}. Check your API key or package configuration at my.20i.com → Reseller API.`,
        "forbidden",
        response.status,
      );
    }

    // Handle 404
    if (response.status === 404) {
      throw new TwentyIApiError(`404 Not Found: ${method} ${path}`, response.status);
    }

    // Handle 5xx – retry
    if (response.status >= 500) {
      if (attempt < this.maxRetries) {
        await delay(1000 * attempt);
        return this.request<T>(method, path, body, attempt + 1);
      }
      throw new TwentyIApiError(`20i server error ${response.status}: ${text.substring(0, 200)}`, response.status);
    }

    // Handle other non-2xx
    if (!response.ok) {
      throw new TwentyIApiError(`20i error ${response.status}: ${text.substring(0, 300)}`, response.status);
    }

    return data as T;
  }

  // ── Convenience methods ────────────────────────────────────────────────────

  get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  delete<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("DELETE", path, body);
  }
}

// ─── Error Classes ────────────────────────────────────────────────────────────

export class TwentyIApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "TwentyIApiError";
  }
}

export class TwentyIAuthError extends Error {
  constructor(
    message: string,
    public readonly reason: "wrong_key" | "ip_blocked" | "ip_or_unknown" | "forbidden",
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "TwentyIAuthError";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a TwentyIClient instance from a raw API key string.
 * Handles sanitisation internally.
 */
export function createClient(apiKey: string, opts?: Partial<TwentyIConfig>): TwentyIClient {
  return new TwentyIClient({ apiKey, ...opts });
}
