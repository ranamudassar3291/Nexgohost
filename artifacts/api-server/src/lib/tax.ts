/**
 * Tax & Compliance Engine
 * Applies VAT/GST rates based on the user's registered country.
 * Zero-overwrite protection: only applies to NEW invoices.
 */

export interface TaxInfo {
  rate: number;       // e.g. 0.17 for 17%
  label: string;      // e.g. "GST 17%"
  applicable: boolean;
}

/**
 * Country → Tax rate mapping.
 * Rates are standard VAT/GST percentages (as decimals).
 * Countries listed as 0 are either tax-free or outside tax scope.
 */
const TAX_RATES: Record<string, { rate: number; label: string }> = {
  // Pakistan — GST 17% on services/digital
  PK:  { rate: 0.17, label: "GST" },
  // EU Countries — VAT (approximate standard rates)
  DE:  { rate: 0.19, label: "VAT" },
  FR:  { rate: 0.20, label: "VAT" },
  GB:  { rate: 0.20, label: "VAT" },
  IT:  { rate: 0.22, label: "VAT" },
  ES:  { rate: 0.21, label: "VAT" },
  NL:  { rate: 0.21, label: "VAT" },
  BE:  { rate: 0.21, label: "VAT" },
  AT:  { rate: 0.20, label: "VAT" },
  PT:  { rate: 0.23, label: "VAT" },
  GR:  { rate: 0.24, label: "VAT" },
  FI:  { rate: 0.25, label: "VAT" },
  IE:  { rate: 0.23, label: "VAT" },
  SE:  { rate: 0.25, label: "VAT" },
  NO:  { rate: 0.25, label: "VAT" },
  DK:  { rate: 0.25, label: "VAT" },
  CH:  { rate: 0.077, label: "VAT" },
  PL:  { rate: 0.23, label: "VAT" },
  CZ:  { rate: 0.21, label: "VAT" },
  HU:  { rate: 0.27, label: "VAT" },
  RO:  { rate: 0.19, label: "VAT" },
  // Gulf — VAT introduced
  AE:  { rate: 0.05, label: "VAT" },
  SA:  { rate: 0.15, label: "VAT" },
  BH:  { rate: 0.10, label: "VAT" },
  QA:  { rate: 0,    label: "VAT" },
  KW:  { rate: 0,    label: "VAT" },
  OM:  { rate: 0.05, label: "VAT" },
  // Asia Pacific
  AU:  { rate: 0.10, label: "GST" },
  NZ:  { rate: 0.15, label: "GST" },
  IN:  { rate: 0.18, label: "GST" },
  SG:  { rate: 0.09, label: "GST" },
  MY:  { rate: 0.06, label: "SST" },
  // Americas — No federal sales tax at purchase level for most
  US:  { rate: 0,    label: "Sales Tax" },
  CA:  { rate: 0.05, label: "GST" },
  MX:  { rate: 0.16, label: "VAT" },
  BR:  { rate: 0,    label: "Tax" },
  // Elsewhere — default 0
};

/**
 * Get the tax info for a given country code.
 * Returns rate=0 / applicable=false for unlisted or zero-tax countries.
 */
export function getTaxInfo(countryCode: string): TaxInfo {
  const entry = TAX_RATES[countryCode?.toUpperCase() ?? ""];
  if (!entry || entry.rate === 0) {
    return { rate: 0, label: entry?.label ?? "Tax", applicable: false };
  }
  return { rate: entry.rate, label: `${entry.label} ${Math.round(entry.rate * 100)}%`, applicable: true };
}

/**
 * Calculate tax on a given base amount (PKR).
 * @param baseAmount  Pre-tax amount (PKR)
 * @param countryCode ISO 3166-1 alpha-2
 */
export function calculateTax(baseAmount: number, countryCode: string): {
  taxAmount: number;
  totalWithTax: number;
  info: TaxInfo;
} {
  const info = getTaxInfo(countryCode);
  const taxAmount = info.applicable ? Math.round(baseAmount * info.rate * 100) / 100 : 0;
  return { taxAmount, totalWithTax: baseAmount + taxAmount, info };
}
