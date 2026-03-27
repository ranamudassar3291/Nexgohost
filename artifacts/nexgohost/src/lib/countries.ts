/**
 * Country list with ISO-3166-1 alpha-2 codes, currency mapping, and phone dial codes.
 * Used for the country selector and smart phone input on the registration page.
 */

export interface CountryOption {
  code: string;     // ISO 3166-1 alpha-2 e.g. "PK"
  name: string;     // Display name e.g. "Pakistan"
  currency: string; // ISO 4217 e.g. "PKR"
  flag: string;     // Emoji flag
  dialCode: string; // Phone dial code e.g. "+92"
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
  { code: "PK", name: "Pakistan",              currency: "PKR", flag: "🇵🇰", dialCode: "+92"  },
  { code: "IN", name: "India",                 currency: "INR", flag: "🇮🇳", dialCode: "+91"  },
  { code: "BD", name: "Bangladesh",            currency: "PKR", flag: "🇧🇩", dialCode: "+880" },
  { code: "LK", name: "Sri Lanka",             currency: "PKR", flag: "🇱🇰", dialCode: "+94"  },
  { code: "NP", name: "Nepal",                 currency: "PKR", flag: "🇳🇵", dialCode: "+977" },
  // Gulf / Middle East
  { code: "AE", name: "United Arab Emirates",  currency: "AED", flag: "🇦🇪", dialCode: "+971" },
  { code: "SA", name: "Saudi Arabia",          currency: "AED", flag: "🇸🇦", dialCode: "+966" },
  { code: "QA", name: "Qatar",                 currency: "AED", flag: "🇶🇦", dialCode: "+974" },
  { code: "KW", name: "Kuwait",                currency: "AED", flag: "🇰🇼", dialCode: "+965" },
  { code: "BH", name: "Bahrain",               currency: "AED", flag: "🇧🇭", dialCode: "+973" },
  { code: "OM", name: "Oman",                  currency: "AED", flag: "🇴🇲", dialCode: "+968" },
  // English-speaking
  { code: "US", name: "United States",         currency: "USD", flag: "🇺🇸", dialCode: "+1"   },
  { code: "GB", name: "United Kingdom",        currency: "GBP", flag: "🇬🇧", dialCode: "+44"  },
  { code: "AU", name: "Australia",             currency: "AUD", flag: "🇦🇺", dialCode: "+61"  },
  { code: "CA", name: "Canada",                currency: "CAD", flag: "🇨🇦", dialCode: "+1"   },
  { code: "SG", name: "Singapore",             currency: "USD", flag: "🇸🇬", dialCode: "+65"  },
  { code: "MY", name: "Malaysia",              currency: "USD", flag: "🇲🇾", dialCode: "+60"  },
  { code: "NG", name: "Nigeria",               currency: "USD", flag: "🇳🇬", dialCode: "+234" },
  { code: "ZA", name: "South Africa",          currency: "USD", flag: "🇿🇦", dialCode: "+27"  },
  // Europe
  { code: "DE", name: "Germany",               currency: "EUR", flag: "🇩🇪", dialCode: "+49"  },
  { code: "FR", name: "France",                currency: "EUR", flag: "🇫🇷", dialCode: "+33"  },
  { code: "ES", name: "Spain",                 currency: "EUR", flag: "🇪🇸", dialCode: "+34"  },
  { code: "IT", name: "Italy",                 currency: "EUR", flag: "🇮🇹", dialCode: "+39"  },
  { code: "NL", name: "Netherlands",           currency: "EUR", flag: "🇳🇱", dialCode: "+31"  },
  { code: "PT", name: "Portugal",              currency: "EUR", flag: "🇵🇹", dialCode: "+351" },
  { code: "AT", name: "Austria",               currency: "EUR", flag: "🇦🇹", dialCode: "+43"  },
  { code: "BE", name: "Belgium",               currency: "EUR", flag: "🇧🇪", dialCode: "+32"  },
  { code: "GR", name: "Greece",                currency: "EUR", flag: "🇬🇷", dialCode: "+30"  },
  { code: "FI", name: "Finland",               currency: "EUR", flag: "🇫🇮", dialCode: "+358" },
  { code: "IE", name: "Ireland",               currency: "EUR", flag: "🇮🇪", dialCode: "+353" },
  { code: "SE", name: "Sweden",                currency: "USD", flag: "🇸🇪", dialCode: "+46"  },
  { code: "NO", name: "Norway",                currency: "USD", flag: "🇳🇴", dialCode: "+47"  },
  { code: "DK", name: "Denmark",               currency: "USD", flag: "🇩🇰", dialCode: "+45"  },
  { code: "CH", name: "Switzerland",           currency: "USD", flag: "🇨🇭", dialCode: "+41"  },
  { code: "PL", name: "Poland",                currency: "EUR", flag: "🇵🇱", dialCode: "+48"  },
  { code: "CZ", name: "Czech Republic",        currency: "EUR", flag: "🇨🇿", dialCode: "+420" },
  { code: "HU", name: "Hungary",               currency: "EUR", flag: "🇭🇺", dialCode: "+36"  },
  { code: "RO", name: "Romania",               currency: "EUR", flag: "🇷🇴", dialCode: "+40"  },
  // Americas
  { code: "MX", name: "Mexico",                currency: "USD", flag: "🇲🇽", dialCode: "+52"  },
  { code: "BR", name: "Brazil",                currency: "USD", flag: "🇧🇷", dialCode: "+55"  },
  { code: "AR", name: "Argentina",             currency: "USD", flag: "🇦🇷", dialCode: "+54"  },
  { code: "CO", name: "Colombia",              currency: "USD", flag: "🇨🇴", dialCode: "+57"  },
  { code: "CL", name: "Chile",                 currency: "USD", flag: "🇨🇱", dialCode: "+56"  },
  // Africa
  { code: "EG", name: "Egypt",                 currency: "USD", flag: "🇪🇬", dialCode: "+20"  },
  { code: "KE", name: "Kenya",                 currency: "USD", flag: "🇰🇪", dialCode: "+254" },
  { code: "GH", name: "Ghana",                 currency: "USD", flag: "🇬🇭", dialCode: "+233" },
  // Asia Pacific
  { code: "JP", name: "Japan",                 currency: "USD", flag: "🇯🇵", dialCode: "+81"  },
  { code: "CN", name: "China",                 currency: "USD", flag: "🇨🇳", dialCode: "+86"  },
  { code: "KR", name: "South Korea",           currency: "USD", flag: "🇰🇷", dialCode: "+82"  },
  { code: "ID", name: "Indonesia",             currency: "USD", flag: "🇮🇩", dialCode: "+62"  },
  { code: "PH", name: "Philippines",           currency: "USD", flag: "🇵🇭", dialCode: "+63"  },
  { code: "TH", name: "Thailand",              currency: "USD", flag: "🇹🇭", dialCode: "+66"  },
  { code: "VN", name: "Vietnam",               currency: "USD", flag: "🇻🇳", dialCode: "+84"  },
  { code: "TR", name: "Turkey",                currency: "USD", flag: "🇹🇷", dialCode: "+90"  },
];

/** Find a country by ISO code */
export function findCountry(code: string): CountryOption | undefined {
  return COUNTRIES.find(c => c.code === code);
}

/** Map country code to its billing currency code */
export function countryToCurrency(countryCode: string): string {
  return COUNTRY_CURRENCY_MAP[countryCode] ?? "USD";
}
