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
 * Preserves '+' which is part of the Combined Key format: GeneralKey+OAuthKey
 */
export function sanitiseKey(raw: string): string {
  return raw
    .trim()
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u007F]/g, "") // zero-width + DEL
    .replace(/[\r\n\t]/g, "");                          // strip control chars
}

/**
 * Encode the clean API key to the base64 Bearer token.
 * IMPORTANT: a trailing "\n" MUST be appended before encoding — this is
 * required by 20i's API (proven by decoding their official docs example token).
 */
export function encodeKey(cleanKey: string): string {
  return Buffer.from(cleanKey + "\n").toString("base64");
}

/**
 * Build the full Authorization header value.
 * Returns: "Bearer <base64(cleanKey + "\n")>"
 */
export function buildAuthHeader(apiKey: string): string {
  const clean = sanitiseKey(apiKey);
  const token = encodeKey(clean);
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
        `401 — Authentication failed. IP may not be whitelisted. Response: ${text.substring(0, 200)}`,
        "ip_or_unknown",
        response.status,
      );
    }

    // Handle 403 – often IP whitelist
    if (response.status === 403) {
      const perm = (data as TwentyIErrorResponse)?.permission;
      if (perm === "IpMatch") {
        throw new TwentyIAuthError(
          `403 — IP not whitelisted. Add this server's outbound IP at my.20i.com → Reseller API → IP Whitelist.`,
          "ip_blocked",
          response.status,
        );
      }
      throw new TwentyIAuthError(
        `403 — Access denied. ${text.substring(0, 200)}`,
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
