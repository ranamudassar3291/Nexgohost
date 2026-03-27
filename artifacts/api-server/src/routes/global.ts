/**
 * GET /api/global/config
 * Public endpoint — no auth, no API key required.
 * Returns user's IP-detected country/currency, live exchange rates, and formatted price helpers.
 * Designed for the website (noehost.com) to call on page load.
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { currenciesTable, settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

// ── Country → Currency map (abbreviated; covers most of the world) ────────────
const COUNTRY_CURRENCY: Record<string, string> = {
  PK: "PKR", US: "USD", GB: "GBP", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR",
  NL: "EUR", BE: "EUR", AT: "EUR", PT: "EUR", GR: "EUR", FI: "EUR", IE: "EUR",
  SK: "EUR", SI: "EUR", LU: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", MT: "EUR",
  CY: "EUR", AE: "AED", SA: "SAR", AU: "AUD", CA: "CAD", IN: "INR",
  SG: "SGD", MY: "MYR", BD: "BDT", NZ: "NZD", ZA: "ZAR", NG: "NGN",
  JP: "JPY", CN: "CNY", KR: "KRW", BR: "BRL", MX: "MXN", AR: "ARS",
  CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK",
  HU: "HUF", RO: "RON", TR: "TRY", QA: "QAR", KW: "KWD", BH: "BHD",
  OM: "OMR", EG: "EGP", GH: "GHS", KE: "KES", TZ: "TZS", ET: "ETB",
};

// ── IP Geolocation: 3-provider fallback chain ─────────────────────────────────
async function detectCountryFromIp(ip: string): Promise<string | null> {
  // Skip private/loopback IPs
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("10.") ||
      ip.startsWith("192.168.") || ip.startsWith("172.")) {
    return null;
  }

  const providers = [
    async () => {
      const r = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      return d?.country_code as string ?? null;
    },
    async () => {
      const r = await fetch(`https://ipinfo.io/${ip}/json`, { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      return d?.country as string ?? null;
    },
    async () => {
      const r = await fetch(`https://freeipapi.com/api/json/${ip}`, { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      return d?.countryCode as string ?? null;
    },
  ];

  for (const provider of providers) {
    try {
      const code = await provider();
      if (code && /^[A-Z]{2}$/.test(code)) return code;
    } catch { /* try next */ }
  }
  return null;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]!.trim();
  return req.socket?.remoteAddress ?? "";
}

// ── GET /api/global/config ────────────────────────────────────────────────────
router.get("/global/config", async (req: Request, res: Response) => {
  try {
    // 1. Load all active currencies from DB
    const currencies = await db.select().from(currenciesTable)
      .where(eq(currenciesTable.isActive, true));

    const pkr = currencies.find(c => c.code === "PKR") ?? {
      code: "PKR", symbol: "Rs.", name: "Pakistani Rupee", exchangeRate: "1",
    };

    // 2. Load cache freshness timestamp
    const [cacheRow] = await db.select().from(settingsTable)
      .where(eq(settingsTable.key, "currency_last_refresh")).limit(1);
    const lastRefreshed = cacheRow?.value ?? null;
    const ageHours = lastRefreshed
      ? (Date.now() - new Date(lastRefreshed).getTime()) / 3600000
      : null;

    // 3. Detect country from IP
    const ip = getClientIp(req);
    const countryCode = await detectCountryFromIp(ip);
    const detectedCurrencyCode = countryCode ? (COUNTRY_CURRENCY[countryCode] ?? "PKR") : "PKR";

    // 4. Resolve detected currency (fallback to PKR if not in DB)
    const detectedCurrency = currencies.find(c => c.code === detectedCurrencyCode)
      ?? currencies.find(c => c.code === "PKR")
      ?? { code: "PKR", symbol: "Rs.", name: "Pakistani Rupee", exchangeRate: "1" };

    // 5. Build rate map (PKR → target)
    const rateMap: Record<string, { symbol: string; rate: number; name: string }> = {};
    for (const c of currencies) {
      rateMap[c.code] = {
        symbol: c.symbol,
        rate:   Number(c.exchangeRate) || 1,
        name:   c.name,
      };
    }

    res.json({
      detectedIp:     ip || null,
      detectedCountry: countryCode,
      detectedCurrency: {
        code:   detectedCurrency.code,
        symbol: detectedCurrency.symbol,
        rate:   Number(detectedCurrency.exchangeRate) || 1,
        name:   detectedCurrency.name,
      },
      baseCurrency: {
        code:   pkr.code,
        symbol: pkr.symbol,
      },
      currencies: currencies.map(c => ({
        code:         c.code,
        symbol:       c.symbol,
        name:         c.name,
        exchangeRate: Number(c.exchangeRate) || 1,
        isDefault:    c.isDefault,
        isActive:     c.isActive,
      })),
      rateCache: {
        lastRefreshed,
        ageHours:  ageHours !== null ? Math.round(ageHours * 10) / 10 : null,
        cacheFresh: ageHours !== null && ageHours < 24,
      },
      // Convenience: sample prices for a $1 PKR base amount in detected currency
      formatHint: {
        examplePkr:        1000,
        exampleConverted:  Math.round(1000 * (Number(detectedCurrency.exchangeRate) || 1) * 100) / 100,
        symbol:            detectedCurrency.symbol,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "global/config failed", details: err.message });
  }
});

export default router;
