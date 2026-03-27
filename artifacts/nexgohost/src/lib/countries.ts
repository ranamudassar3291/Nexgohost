/**
 * Country list with ISO-3166-1 alpha-2 codes and currency mapping.
 * Used for the country selector on the registration page.
 */

export interface CountryOption {
  code: string;   // ISO 3166-1 alpha-2 e.g. "PK"
  name: string;   // Display name e.g. "Pakistan"
  currency: string; // ISO 4217 e.g. "PKR"
  flag: string;   // Emoji flag
}

// Maps country code → default currency for new registrations
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  PK: "PKR", US: "USD", GB: "GBP",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR",
  PT: "EUR", AT: "EUR", BE: "EUR", GR: "EUR", FI: "EUR",
  IE: "EUR", LU: "EUR", MT: "EUR", CY: "EUR", SK: "EUR",
  SI: "EUR", LT: "EUR", LV: "EUR", EE: "EUR",
  AU: "AUD", CA: "CAD", IN: "INR",
  AE: "AED", SA: "AED", QA: "AED", KW: "AED", BH: "AED", OM: "AED",
  SG: "USD", MY: "USD", NG: "USD", ZA: "USD",
  BD: "PKR", LK: "PKR", NP: "PKR",
};

export const COUNTRIES: CountryOption[] = [
  // South Asia
  { code: "PK", name: "Pakistan",           currency: "PKR", flag: "🇵🇰" },
  { code: "IN", name: "India",              currency: "INR", flag: "🇮🇳" },
  { code: "BD", name: "Bangladesh",         currency: "PKR", flag: "🇧🇩" },
  { code: "LK", name: "Sri Lanka",          currency: "PKR", flag: "🇱🇰" },
  { code: "NP", name: "Nepal",              currency: "PKR", flag: "🇳🇵" },
  // Gulf / Middle East
  { code: "AE", name: "United Arab Emirates", currency: "AED", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia",       currency: "AED", flag: "🇸🇦" },
  { code: "QA", name: "Qatar",              currency: "AED", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait",             currency: "AED", flag: "🇰🇼" },
  { code: "BH", name: "Bahrain",            currency: "AED", flag: "🇧🇭" },
  { code: "OM", name: "Oman",               currency: "AED", flag: "🇴🇲" },
  // English-speaking
  { code: "US", name: "United States",      currency: "USD", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom",     currency: "GBP", flag: "🇬🇧" },
  { code: "AU", name: "Australia",          currency: "AUD", flag: "🇦🇺" },
  { code: "CA", name: "Canada",             currency: "CAD", flag: "🇨🇦" },
  { code: "SG", name: "Singapore",          currency: "USD", flag: "🇸🇬" },
  { code: "MY", name: "Malaysia",           currency: "USD", flag: "🇲🇾" },
  { code: "NG", name: "Nigeria",            currency: "USD", flag: "🇳🇬" },
  { code: "ZA", name: "South Africa",       currency: "USD", flag: "🇿🇦" },
  // Europe
  { code: "DE", name: "Germany",            currency: "EUR", flag: "🇩🇪" },
  { code: "FR", name: "France",             currency: "EUR", flag: "🇫🇷" },
  { code: "ES", name: "Spain",              currency: "EUR", flag: "🇪🇸" },
  { code: "IT", name: "Italy",              currency: "EUR", flag: "🇮🇹" },
  { code: "NL", name: "Netherlands",        currency: "EUR", flag: "🇳🇱" },
  { code: "PT", name: "Portugal",           currency: "EUR", flag: "🇵🇹" },
  { code: "AT", name: "Austria",            currency: "EUR", flag: "🇦🇹" },
  { code: "BE", name: "Belgium",            currency: "EUR", flag: "🇧🇪" },
  { code: "GR", name: "Greece",             currency: "EUR", flag: "🇬🇷" },
  { code: "FI", name: "Finland",            currency: "EUR", flag: "🇫🇮" },
  { code: "IE", name: "Ireland",            currency: "EUR", flag: "🇮🇪" },
  { code: "SE", name: "Sweden",             currency: "USD", flag: "🇸🇪" },
  { code: "NO", name: "Norway",             currency: "USD", flag: "🇳🇴" },
  { code: "DK", name: "Denmark",            currency: "USD", flag: "🇩🇰" },
  { code: "CH", name: "Switzerland",        currency: "USD", flag: "🇨🇭" },
  { code: "PL", name: "Poland",             currency: "EUR", flag: "🇵🇱" },
  { code: "CZ", name: "Czech Republic",     currency: "EUR", flag: "🇨🇿" },
  { code: "HU", name: "Hungary",            currency: "EUR", flag: "🇭🇺" },
  { code: "RO", name: "Romania",            currency: "EUR", flag: "🇷🇴" },
  // Americas
  { code: "MX", name: "Mexico",             currency: "USD", flag: "🇲🇽" },
  { code: "BR", name: "Brazil",             currency: "USD", flag: "🇧🇷" },
  { code: "AR", name: "Argentina",          currency: "USD", flag: "🇦🇷" },
  { code: "CO", name: "Colombia",           currency: "USD", flag: "🇨🇴" },
  { code: "CL", name: "Chile",              currency: "USD", flag: "🇨🇱" },
  // Africa
  { code: "EG", name: "Egypt",              currency: "USD", flag: "🇪🇬" },
  { code: "KE", name: "Kenya",              currency: "USD", flag: "🇰🇪" },
  { code: "GH", name: "Ghana",              currency: "USD", flag: "🇬🇭" },
  // Asia Pacific
  { code: "JP", name: "Japan",              currency: "USD", flag: "🇯🇵" },
  { code: "CN", name: "China",              currency: "USD", flag: "🇨🇳" },
  { code: "KR", name: "South Korea",        currency: "USD", flag: "🇰🇷" },
  { code: "ID", name: "Indonesia",          currency: "USD", flag: "🇮🇩" },
  { code: "PH", name: "Philippines",        currency: "USD", flag: "🇵🇭" },
  { code: "TH", name: "Thailand",           currency: "USD", flag: "🇹🇭" },
  { code: "VN", name: "Vietnam",            currency: "USD", flag: "🇻🇳" },
  { code: "TR", name: "Turkey",             currency: "USD", flag: "🇹🇷" },
];

/** Find a country by ISO code */
export function findCountry(code: string): CountryOption | undefined {
  return COUNTRIES.find(c => c.code === code);
}

/** Map country code to its billing currency code */
export function countryToCurrency(countryCode: string): string {
  return COUNTRY_CURRENCY_MAP[countryCode] ?? "USD";
}
