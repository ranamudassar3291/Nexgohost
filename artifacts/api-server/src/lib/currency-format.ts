/**
 * Server-side locale-aware currency formatting (mirrors the frontend utility).
 * Used in cron emails, invoice PDFs, and any backend-generated price strings.
 */

interface LocaleConfig {
  locale: string;
  position: "before" | "after";
  separator?: string;
}

const LOCALE_MAP: Record<string, LocaleConfig> = {
  PKR: { locale: "en-US",  position: "before", separator: " " },
  USD: { locale: "en-US",  position: "before" },
  GBP: { locale: "en-GB",  position: "before" },
  EUR: { locale: "de-DE",  position: "after",  separator: "\u00A0" },
  AED: { locale: "en-AE",  position: "before", separator: " " },
  AUD: { locale: "en-AU",  position: "before" },
  CAD: { locale: "en-CA",  position: "before" },
  INR: { locale: "en-IN",  position: "before" },
};

/**
 * Format an already-converted monetary amount for display.
 * @param amount  - value in the target currency (not PKR)
 * @param code    - ISO 4217 code e.g. "USD"
 * @param symbol  - display symbol e.g. "$"
 */
export function formatCurrency(amount: number, code: string, symbol: string): string {
  const safe = isNaN(amount) || amount == null ? 0 : amount;
  const cfg  = LOCALE_MAP[code] ?? { locale: "en-US", position: "before" };

  const formatted = safe.toLocaleString(cfg.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (code === "PKR") return `Rs. ${formatted}`;
  if (cfg.position === "after") return `${formatted}${cfg.separator ?? "\u00A0"}${symbol}`;
  return `${symbol}${cfg.separator ?? ""}${formatted}`;
}

/**
 * Convert a PKR base amount and format it in the given currency.
 * Falls back to PKR display if rate is missing/zero.
 */
export function convertAndFormat(
  pkrAmount: number,
  code?: string | null,
  symbol?: string | null,
  rate?: number | string | null,
): string {
  const safeRate = Number(rate ?? 1);
  const safeCode = code?.trim() || "PKR";
  const safeSym  = symbol?.trim() || "Rs.";

  if (!safeRate || isNaN(safeRate)) return formatCurrency(pkrAmount, "PKR", "Rs.");

  const converted = pkrAmount * safeRate;
  return formatCurrency(converted, safeCode, safeSym);
}
