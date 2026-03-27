/**
 * System-to-System API Key ("Parda" security layer)
 * ─────────────────────────────────────────────────
 * Protects public sync endpoints so only the official website/cart
 * can fetch plans and domain prices. The key is stored in the DB
 * (settings.key = 'system_api_key') and must be sent in the
 * X-System-API-Key header on every request.
 */
import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

let _cachedKey: string | null = null;
let _cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000; // refresh in-memory cache every 5 min

export async function getSystemApiKey(): Promise<string | null> {
  const now = Date.now();
  if (_cachedKey && now - _cacheTs < CACHE_TTL) return _cachedKey;

  try {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "system_api_key")).limit(1);
    _cachedKey = row?.value ?? null;
    _cacheTs = now;
    return _cachedKey;
  } catch {
    return _cachedKey; // return stale cache on DB error
  }
}

/** Generates and stores a new system API key, returning it */
export async function generateSystemApiKey(): Promise<string> {
  const newKey = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, "system_api_key")).limit(1);
  if (existing) {
    await db.update(settingsTable).set({ value: newKey, updatedAt: new Date() }).where(eq(settingsTable.key, "system_api_key"));
  } else {
    await db.insert(settingsTable).values({ key: "system_api_key", value: newKey, updatedAt: new Date() });
  }
  _cachedKey = newKey;
  _cacheTs = Date.now();
  console.log(`[SYSTEM-KEY] New system API key generated and stored`);
  return newKey;
}

/** Express middleware: validates X-System-API-Key header */
export async function validateSystemApiKey(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers["x-system-api-key"] as string | undefined;
  if (!incoming) {
    res.status(401).json({ error: "Missing X-System-API-Key header" });
    return;
  }
  const valid = await getSystemApiKey();
  if (!valid) {
    // No key configured — allow through (open during initial setup)
    next();
    return;
  }
  if (incoming !== valid) {
    res.status(403).json({ error: "Invalid API key" });
    return;
  }
  next();
}
