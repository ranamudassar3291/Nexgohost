/**
 * Public Sync API — for website-to-panel product/price sync
 * Secured with X-System-API-Key header (Parda system).
 *
 * GET /api/sync/plans?currency=USD
 * GET /api/sync/domain-extensions?currency=USD
 * GET /api/sync/currencies
 * POST /api/admin/sync/rotate-key  (admin only — regenerates the system API key)
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  hostingPlansTable, domainExtensionsTable, currenciesTable,
} from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { validateSystemApiKey, generateSystemApiKey } from "../lib/systemApiKey.js";
import { authenticate, requireAdmin } from "../lib/auth.js";

const router = Router();

// ── Helper: resolve currency and rate ────────────────────────────────────────
async function resolveCurrency(code?: string): Promise<{ code: string; symbol: string; rate: number }> {
  const currencies = await db.select().from(currenciesTable).where(eq(currenciesTable.isActive, true));
  if (!currencies.length) return { code: "PKR", symbol: "Rs.", rate: 1 };

  const defaultCurrency = currencies.find(c => c.isDefault) ?? currencies[0]!;
  const pkr = currencies.find(c => c.code === "PKR");

  const selected = code ? currencies.find(c => c.code.toUpperCase() === code.toUpperCase()) : null;
  const target = selected ?? defaultCurrency;

  // Rates in the DB are relative to the default currency (usually PKR).
  // If PKR is the default, rate stored for USD is how many USD per PKR.
  // We want: how many target-currency units per 1 PKR base unit.
  const rate = Number(target.exchangeRate) || 1;

  return {
    code: target.code,
    symbol: target.symbol,
    rate,
  };
}

function convertPrice(pkrPrice: number, rate: number): number {
  return Math.round(pkrPrice * rate * 100) / 100;
}

// ── GET /api/sync/plans ──────────────────────────────────────────────────────
router.get("/sync/plans", validateSystemApiKey, async (req, res) => {
  try {
    const currency = await resolveCurrency(req.query["currency"] as string);

    const plans = await db.select().from(hostingPlansTable)
      .where(eq(hostingPlansTable.isActive, true));

    const converted = plans.map(p => {
      const base    = Number(p.price ?? 0);
      const yearly  = Number(p.yearlyPrice ?? 0);
      const qtr     = Number(p.quarterlyPrice ?? 0);
      const semi    = Number(p.semiannualPrice ?? 0);
      const renewal = Number(p.renewalPrice ?? base);
      const r       = currency.rate;
      return {
        id:               p.id,
        name:             p.name,
        description:      p.description,
        features:         p.features,
        groupId:          p.groupId,
        freeDomainEnabled: p.freeDomainEnabled ?? false,
        freeDomainTlds:   p.freeDomainTlds ?? [],
        diskSpace:        p.diskSpace,
        bandwidth:        p.bandwidth,
        emailAccounts:    p.emailAccounts,
        databases:        p.databases,
        currency: {
          code:   currency.code,
          symbol: currency.symbol,
        },
        prices: {
          monthly:     convertPrice(base, r),
          quarterly:   qtr  ? convertPrice(qtr,  r) : null,
          semiannual:  semi ? convertPrice(semi, r) : null,
          yearly:      yearly ? convertPrice(yearly, r) : null,
          renewal:     convertPrice(renewal, r),
          // Raw PKR prices also included for Safepay (PKR-only gateway)
          monthlyPkr:  base,
          yearlyPkr:   yearly || null,
          renewalPkr:  renewal,
        },
        isActive:    p.isActive,
      };
    });

    res.json({
      currency: { code: currency.code, symbol: currency.symbol, rate: currency.rate },
      plans: converted,
      total: converted.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sync/domain-extensions ─────────────────────────────────────────
router.get("/sync/domain-extensions", validateSystemApiKey, async (req, res) => {
  try {
    const currency = await resolveCurrency(req.query["currency"] as string);
    const r = currency.rate;

    const extensions = await db.select().from(domainExtensionsTable)
      .where(eq(domainExtensionsTable.status, "active"))
      .orderBy(asc(domainExtensionsTable.sortOrder), asc(domainExtensionsTable.extension));

    const converted = extensions.map(e => ({
      id:             e.id,
      extension:      e.extension,
      currency: {
        code:   currency.code,
        symbol: currency.symbol,
      },
      prices: {
        register:      convertPrice(Number(e.registerPrice ?? 0), r),
        register2Year: e.register2YearPrice ? convertPrice(Number(e.register2YearPrice), r) : null,
        register3Year: e.register3YearPrice ? convertPrice(Number(e.register3YearPrice), r) : null,
        renewal:       convertPrice(Number(e.renewalPrice ?? 0), r),
        transfer:      convertPrice(Number(e.transferPrice ?? 0), r),
        // PKR prices for Safepay
        registerPkr:   Number(e.registerPrice ?? 0),
        renewalPkr:    Number(e.renewalPrice ?? 0),
      },
      isActive:   e.isActive,
      sortOrder:  e.sortOrder,
      isFeatured: (e as any).isFeatured ?? false,
    }));

    res.json({
      currency: { code: currency.code, symbol: currency.symbol, rate: currency.rate },
      extensions: converted,
      total: converted.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sync/currencies — list active currencies (public, key-gated) ───
router.get("/sync/currencies", validateSystemApiKey, async (_req, res) => {
  try {
    const currencies = await db.select().from(currenciesTable)
      .where(eq(currenciesTable.isActive, true))
      .orderBy(asc(currenciesTable.code));
    res.json(currencies.map(c => ({
      code:         c.code,
      name:         c.name,
      symbol:       c.symbol,
      exchangeRate: Number(c.exchangeRate),
      isDefault:    c.isDefault,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/sync/rotate-key — generate a new system API key ─────────
router.post("/admin/sync/rotate-key", authenticate, requireAdmin, async (_req, res) => {
  try {
    const newKey = await generateSystemApiKey();
    res.json({
      success: true,
      message: "System API key rotated. Update your website configuration with the new key.",
      apiKey: newKey,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/sync/key — view current key (admin only) ──────────────────
router.get("/admin/sync/key", authenticate, requireAdmin, async (_req, res) => {
  try {
    const { getSystemApiKey } = await import("../lib/systemApiKey.js");
    const key = await getSystemApiKey();
    res.json({
      apiKey: key ?? null,
      configured: !!key,
      usage: {
        header:  "X-System-API-Key",
        example: `curl -H "X-System-API-Key: ${key ?? '<key>'}" /api/sync/plans?currency=USD`,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
