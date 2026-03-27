/**
 * Locale-aware currency formatting
 * Ensures each currency uses the correct thousands separator, decimal mark,
 * and symbol position (e.g. $1,245.00 vs 1.245,00 € vs Rs. 1,245.00)
 */

interface FormatOptions {
  code: string;
  symbol: string;
}

// Locale map: currency code → [BCP 47 locale, symbol placement]
const LOCALE_MAP: Record<string, { locale: string; position: "before" | "after"; separator?: string }> = {
  PKR: { locale: "en-PK",  position: "before", separator: " " },
  USD: { locale: "en-US",  position: "before" },
  GBP: { locale: "en-GB",  position: "before" },
  EUR: { locale: "de-DE",  position: "after",  separator: "\u00A0" }, // non-breaking space before €
  AED: { locale: "ar-AE",  position: "before", separator: " " },
  AUD: { locale: "en-AU",  position: "before" },
  CAD: { locale: "en-CA",  position: "before" },
  INR: { locale: "en-IN",  position: "before" },
};

/**
 * Format a monetary amount in the correct locale for the given currency.
 * @param amount  - the amount IN the target currency (already converted)
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

  if (code === "PKR") return `Rs.${cfg.separator ?? " "}${formatted}`;

  if (cfg.position === "after") {
    return `${formatted}${cfg.separator ?? "\u00A0"}${symbol}`;
  }
  return `${symbol}${cfg.separator ?? ""}${formatted}`;
}

/**
 * Build a formatPrice function for a given currency context.
 * pkrAmount is the BASE price in PKR; rate is how many target-currency units per 1 PKR.
 */
export function makeFormatter(code: string, symbol: string, rate: number) {
  return function formatPrice(pkrAmount: number): string {
    const safe      = isNaN(pkrAmount) || pkrAmount == null ? 0 : pkrAmount;
    const converted = safe * rate;
    return formatCurrency(converted, code, symbol);
  };
}
