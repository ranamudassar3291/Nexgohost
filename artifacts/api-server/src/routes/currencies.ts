import { Router } from "express";
import { db } from "@workspace/db";
import { currenciesTable, settingsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { eq, ne } from "drizzle-orm";

const router = Router();

const RATE_CACHE_HOURS = 24;

/** Returns true if the last exchange-rate refresh was less than 24 hours ago */
async function isRateCacheFresh(): Promise<boolean> {
  try {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "currency_last_refresh")).limit(1);
    if (!row?.value) return false;
    const last = new Date(row.value).getTime();
    const ageHours = (Date.now() - last) / (1000 * 60 * 60);
    return ageHours < RATE_CACHE_HOURS;
  } catch {
    return false;
  }
}

async function markRateRefresh(): Promise<void> {
  try {
    const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, "currency_last_refresh")).limit(1);
    const now = new Date().toISOString();
    if (existing) {
      await db.update(settingsTable).set({ value: now, updatedAt: new Date() }).where(eq(settingsTable.key, "currency_last_refresh"));
    } else {
      await db.insert(settingsTable).values({ key: "currency_last_refresh", value: now, updatedAt: new Date() }).onConflictDoNothing();
    }
  } catch { /* non-fatal */ }
}

// Fetch live exchange rates from open.er-api.com (free, no API key required)
// Only hits the external API once every 24 hours — uses cached DB rates in between.
export async function refreshExchangeRates(force = false): Promise<{ updated: number; errors: string[]; cached?: boolean }> {
  const errors: string[] = [];
  let updated = 0;

  // 24h cache guard — skip external call if rates are still fresh
  if (!force && await isRateCacheFresh()) {
    return { updated: 0, errors: [], cached: true };
  }

  try {
    // Find base currency (USD or first default)
    const currencies = await db.select().from(currenciesTable).where(eq(currenciesTable.isActive, true));
    if (currencies.length === 0) return { updated: 0, errors: ["No active currencies"] };

    const base = currencies.find(c => c.isDefault)?.code || "USD";
    const url = `https://open.er-api.com/v6/latest/${base}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Exchange rate API returned ${res.status}`);
    const data: { result: string; rates: Record<string, number> } = await res.json();

    if (data.result !== "success" || !data.rates) throw new Error("Invalid API response");

    // Update rates for all non-base currencies
    for (const currency of currencies) {
      if (currency.code === base) {
        // Base currency rate is always 1
        await db.update(currenciesTable).set({ exchangeRate: "1", updatedAt: new Date() }).where(eq(currenciesTable.id, currency.id));
        updated++;
        continue;
      }
      const rate = data.rates[currency.code];
      if (rate == null) {
        errors.push(`Rate not found for ${currency.code}`);
        continue;
      }
      await db.update(currenciesTable).set({ exchangeRate: String(rate), updatedAt: new Date() }).where(eq(currenciesTable.id, currency.id));
      updated++;
    }
    // Stamp the successful refresh time so 24h guard works
    if (updated > 0) await markRateRefresh();
  } catch (err: any) {
    errors.push(err.message || "Unknown error fetching exchange rates");
  }
  return { updated, errors };
}

// GET /api/currencies (public)
router.get("/currencies", async (_req, res) => {
  const currencies = await db.select().from(currenciesTable).where(eq(currenciesTable.isActive, true)).orderBy(currenciesTable.code);
  res.json(currencies);
});

// GET /api/admin/currencies (admin, all)
router.get("/admin/currencies", authenticate, requireAdmin, async (_req, res) => {
  const currencies = await db.select().from(currenciesTable).orderBy(currenciesTable.code);
  res.json(currencies);
});

// POST /api/admin/currencies
router.post("/admin/currencies", authenticate, requireAdmin, async (req, res) => {
  const { code, name, symbol, exchangeRate, isDefault } = req.body;
  if (!code || !name || !symbol) return res.status(400).json({ error: "code, name, symbol are required" });

  if (isDefault) {
    await db.update(currenciesTable).set({ isDefault: false });
  }
  try {
    const [record] = await db.insert(currenciesTable).values({
      code: code.toUpperCase(),
      name,
      symbol,
      exchangeRate: String(exchangeRate || 1),
      isDefault: isDefault ?? false,
      isActive: true,
    }).returning();
    res.status(201).json(record);
  } catch (err: any) {
    if (err.code === "23505") return res.status(400).json({ error: "Currency code already exists" });
    throw err;
  }
});

// PUT /api/admin/currencies/:id
router.put("/admin/currencies/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { code, name, symbol, exchangeRate, isDefault, isActive } = req.body;
  if (isDefault) {
    await db.update(currenciesTable).set({ isDefault: false });
  }
  const updates: Record<string, unknown> = {};
  if (code !== undefined) updates.code = code.toUpperCase();
  if (name !== undefined) updates.name = name;
  if (symbol !== undefined) updates.symbol = symbol;
  if (exchangeRate !== undefined) updates.exchangeRate = String(exchangeRate);
  if (isDefault !== undefined) updates.isDefault = isDefault;
  if (isActive !== undefined) updates.isActive = isActive;
  const [record] = await db.update(currenciesTable).set(updates).where(eq(currenciesTable.id, id)).returning();
  if (!record) return res.status(404).json({ error: "Not found" });
  res.json(record);
});

// DELETE /api/admin/currencies/:id
router.delete("/admin/currencies/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.delete(currenciesTable).where(eq(currenciesTable.id, id));
  res.json({ success: true });
});

// POST /api/admin/currencies/refresh-rates — force-fetch live rates (bypasses 24h cache)
router.post("/admin/currencies/refresh-rates", authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await refreshExchangeRates(true); // force = true, bypasses 24h cache
    const currencies = await db.select().from(currenciesTable).where(eq(currenciesTable.isActive, true));

    // Return last-refresh timestamp
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "currency_last_refresh")).limit(1);
    res.json({ ...result, currencies, lastRefreshed: row?.value ?? null });
  } catch (err: any) {
    console.error("[CURRENCIES] refresh-rates error:", err.message);
    res.status(500).json({ error: "Failed to refresh exchange rates", details: err.message });
  }
});

// GET /api/admin/currencies/cache-status — show 24h cache status
router.get("/admin/currencies/cache-status", authenticate, requireAdmin, async (_req, res) => {
  try {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "currency_last_refresh")).limit(1);
    const last = row?.value ? new Date(row.value) : null;
    const ageHours = last ? (Date.now() - last.getTime()) / (1000 * 60 * 60) : null;
    const nextRefreshIn = ageHours !== null ? Math.max(0, 24 - ageHours) : 0;
    res.json({
      lastRefreshed: last?.toISOString() ?? null,
      ageHours: ageHours !== null ? Math.round(ageHours * 10) / 10 : null,
      cacheFresh: ageHours !== null && ageHours < 24,
      nextRefreshInHours: Math.round(nextRefreshIn * 10) / 10,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
