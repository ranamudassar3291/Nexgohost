/**
 * Simple in-memory cache with TTL support.
 * Used to cache expensive external API calls (e.g. 20i packages/hosting lists).
 * TTL default: 10 minutes.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs = 10 * 60 * 1000): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

export function cacheClear(prefix?: string): void {
  if (!prefix) { store.clear(); return; }
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

/**
 * Cached fetch wrapper.
 * If a valid cached value exists it is returned immediately.
 * Otherwise fetcher() is called, the result is cached, and returned.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 10 * 60 * 1000,
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== undefined) return cached;
  const value = await fetcher();
  cacheSet(key, value, ttlMs);
  return value;
}
